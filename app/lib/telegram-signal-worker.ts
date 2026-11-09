import { createHash } from "node:crypto";
import { CANDLE_MARKETS, CANDLE_FRAMES, type CandleMarket, type CandleFrame } from "../candle-markets";
import { closedCandleSignal } from "./candle-signal";
import { marketPressure, takeProfitLevels } from "./market-pressure";
import { loadCandleFeed } from "./candle-feed";
import { markTelegramSignalFailed, markTelegramSignalSent, markTelegramSignalUnknown, reserveTelegramSignal } from "./telegram-signal-store";

const POLL_MS = 30_000;
const MARKETS = new Set(Object.keys(CANDLE_MARKETS));
const FRAMES = new Set(Object.keys(CANDLE_FRAMES));
type Stream = { market: CandleMarket; frame: CandleFrame };
type PendingRetry = { signalKey: string; market: CandleMarket; frame: CandleFrame; candleTime: number; retryAt: number; expiresAt: number };

declare global {
  var __rfxTelegramSignalWorker: NodeJS.Timeout | "disabled" | undefined;
}

function configuration() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = process.env.TELEGRAM_TARGET_CHAT_ID?.trim() ?? "";
  const rewardRatio = process.env.TELEGRAM_SIGNAL_REWARD_RATIO === "3" ? 3 : 2;
  const configuredStreams = process.env.TELEGRAM_SIGNAL_MARKETS?.trim() || "BTCUSDT:15m";
  const streams: Stream[] = [];
  const invalidMarkets: string[] = [];
  for (const entry of configuredStreams.split(/[\s,]+/)) {
    const [market, frame, extra] = entry.trim().split(":");
    if (!market || !frame || extra || !MARKETS.has(market) || !FRAMES.has(frame)) {
      if (entry.trim()) invalidMarkets.push(entry.trim());
      continue;
    }
    const candidate = { market: market as CandleMarket, frame: frame as CandleFrame };
    if (!streams.some(item => item.market === candidate.market && item.frame === candidate.frame)) streams.push(candidate);
  }
  return { token, chatId, rewardRatio, streams, invalidMarkets };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(timestamp) + " UTC+7";
}

function validLevels(action: "BUY" | "SELL", entry: number | null, stopLoss: number | null, takeProfit: number | null) {
  if (entry === null || stopLoss === null || takeProfit === null || ![entry, stopLoss, takeProfit].every(Number.isFinite)) return false;
  return action === "BUY" ? stopLoss < entry && takeProfit > entry : takeProfit < entry && stopLoss > entry;
}

function buildMessage(input: { stream: Stream; action: "BUY" | "SELL"; entry: number; stopLoss: number; takeProfit: number; candleTime: number; expiresAt: number; source: string; rewardRatio: number; pressure: ReturnType<typeof marketPressure> }) {
  const market = CANDLE_MARKETS[input.stream.market];
  const icon = input.action === "BUY" ? "🟢" : "🔴";
  const targets=takeProfitLevels(input.action,input.entry,input.stopLoss);
  return [
    `RFX BTC TEAM · ${icon} ${input.action} SIGNAL`,
    `Market: ${market.label}`,
    `Timeframe: ${input.stream.frame}`,
    `Entry: ${formatPrice(input.entry)}`,
    `TP1: ${formatPrice(targets[0])}`,
    `TP2: ${formatPrice(targets[1])}`,
    `TP3: ${formatPrice(targets[2])}`,
    `Stop Loss (SL): ${formatPrice(input.stopLoss)}`,
    `Buy / Sell pressure: ${input.pressure.buyPercent}% / ${input.pressure.sellPercent}% (${input.pressure.basis})`,
    `Risk : Reward: 1 : ${input.rewardRatio}`,
    `Confirmed at: ${timeLabel(input.candleTime)}`,
    `Expires: ${timeLabel(input.expiresAt)}`,
    `Data: ${input.source}`,
    "Reference levels from a closed candle, not a guaranteed execution price. Check the current price and trading costs before acting.",
  ].join("\n");
}

async function postToTelegram(token: string, chatId: string, text: string, signalKey: string) {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(12_000),
      redirect: "error",
    });
  } catch {
    await markTelegramSignalUnknown(signalKey).catch(() => undefined);
    console.error("[telegram-signal] Telegram did not confirm delivery; automatic retry was suppressed to prevent a duplicate.");
    return "unknown" as const;
  }

  let result: { ok?: boolean; result?: { message_id?: number } } | null = null;
  try { result = await response.json(); } catch { /* A missing response body is an unknown delivery. */ }
  const messageId = result?.result?.message_id;
  if (response.status >= 500 || (response.ok && result === null)) {
      await markTelegramSignalUnknown(signalKey).catch(() => undefined);
      console.error("[telegram-signal] Telegram delivery status was not confirmed; automatic retry was suppressed to prevent a duplicate.");
      return "unknown" as const;
  }
  if (!response.ok || result?.ok !== true || typeof messageId !== "number" || !Number.isSafeInteger(messageId)) {
    await markTelegramSignalFailed(signalKey, `Telegram API returned HTTP ${response.status}.`).catch(() => undefined);
    console.error(`[telegram-signal] Telegram rejected a signal message (HTTP ${response.status}). Check bot membership and group permissions.`);
    return "failed" as const;
  }

  await markTelegramSignalSent(signalKey, messageId).catch(() => {
    console.error("[telegram-signal] Telegram confirmed delivery, but the delivery record could not be updated; duplicate retry remains blocked.");
  });
  console.info("[telegram-signal] Confirmed Telegram delivery.");
  return "sent" as const;
}

async function sendStreamSignal(stream: Stream, feed: Awaited<ReturnType<typeof loadCandleFeed>>, now: number, token: string, chatId: string, rewardRatio: number, retry?: PendingRetry): Promise<PendingRetry | null> {
  const checked = closedCandleSignal(feed.candles, CANDLE_FRAMES[stream.frame].ms, now, rewardRatio as 2 | 3);
  const signal = checked.signal;
  const candleTime = feed.candles.at(-1)?.time;
  if (checked.expiresAt === null || checked.expiresAt <= now || candleTime === undefined || signal.action === "WAIT"
      || !validLevels(signal.action, signal.entry, signal.stopLoss, signal.takeProfit)) return null;
  const key = createHash("sha256").update(`${stream.market}:${stream.frame}:${candleTime}:${signal.action}`).digest("hex");
  if (retry && (retry.signalKey !== key || retry.candleTime !== candleTime)) return null;
  let reserved: boolean;
  try { reserved = await reserveTelegramSignal(key, stream.market, stream.frame, candleTime, signal.action); }
  catch {
    console.error("[telegram-signal] Delivery store unavailable; will retry while this signal remains current.");
    return { signalKey: key, market: stream.market, frame: stream.frame, candleTime, retryAt: now + 60_000, expiresAt: checked.expiresAt };
  }
  if (!reserved) return null;
  const text = buildMessage({
    stream, action: signal.action, entry: signal.entry!, stopLoss: signal.stopLoss!, takeProfit: signal.takeProfit!,
    candleTime, expiresAt: checked.expiresAt, source: feed.source, rewardRatio, pressure: marketPressure(feed.candles),
  });
  const status = await postToTelegram(token, chatId, text, key);
  return status === "failed" ? { signalKey: key, market: stream.market, frame: stream.frame, candleTime, retryAt: now + 60_000, expiresAt: checked.expiresAt } satisfies PendingRetry : null;
}

function runWorker(token: string, chatId: string, rewardRatio: number, streams: Stream[]) {
  const observed = new Map<string, number>();
  const retries = new Map<string, PendingRetry>();
  const errorTimes = new Map<string, number>();
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      for (const stream of streams) {
        const streamKey = `${stream.market}:${stream.frame}`;
        let feed;
        try { feed = await loadCandleFeed(stream.market, stream.frame, now); }
        catch (error) {
          const last = errorTimes.get(streamKey) ?? 0;
          if (now - last >= 5 * 60_000) {
            console.error(`[telegram-signal] ${streamKey} feed check failed (${error instanceof Error ? error.constructor.name : "unknown error"}).`);
            errorTimes.set(streamKey, now);
          }
          continue;
        }
        errorTimes.delete(streamKey);
        const candleTime = feed.candles.at(-1)?.time;
        if (candleTime === undefined) continue;
        const previous = observed.get(streamKey);
        if (previous === undefined) {
          // Establish a baseline at startup so a restarted worker does not post an old candle signal.
          observed.set(streamKey, candleTime);
          continue;
        }
        if (candleTime <= previous) {
          const retry = retries.get(streamKey);
          if (retry && now >= retry.retryAt && now < retry.expiresAt) {
            const result = await sendStreamSignal(stream, feed, now, token, chatId, rewardRatio, retry);
            if (result) retries.set(streamKey, result);
            else retries.delete(streamKey);
          }
          continue;
        }
        observed.set(streamKey, candleTime);
        retries.delete(streamKey);
        const result = await sendStreamSignal(stream, feed, now, token, chatId, rewardRatio);
        if (result) retries.set(streamKey, result);
      }
    } finally {
      running = false;
    }
  }

  void tick();
  return setInterval(() => void tick(), POLL_MS);
}

export function startTelegramSignalWorker() {
  if (globalThis.__rfxTelegramSignalWorker) return;
  const { token, chatId, rewardRatio, streams, invalidMarkets } = configuration();
  if (!token || !chatId) {
    globalThis.__rfxTelegramSignalWorker = "disabled";
    console.info("[telegram-signal] Publisher disabled: set TELEGRAM_BOT_TOKEN and TELEGRAM_TARGET_CHAT_ID to enable it.");
    return;
  }
  if (streams.length === 0) {
    globalThis.__rfxTelegramSignalWorker = "disabled";
    console.error("[telegram-signal] Publisher disabled: TELEGRAM_SIGNAL_MARKETS has no supported market:timeframe entries.");
    return;
  }
  const timer = runWorker(token, chatId, rewardRatio, streams);
  globalThis.__rfxTelegramSignalWorker = timer;
  timer.unref();
  if (invalidMarkets.length) console.warn(`[telegram-signal] Skipping unsupported market entries: ${invalidMarkets.join(", ")}.`);
  console.info(`[telegram-signal] Publisher active for ${streams.map(stream => `${stream.market}:${stream.frame}`).join(", ")}; waiting for new closed-candle signals.`);
}

export function telegramSignalPublisherStatus(): "active" | "needs-config" | "needs-data-config" | "unsupported-host" | "invalid-markets" | "starting" {
  const { token, chatId, streams } = configuration();
  if (!token || !chatId) return "needs-config";
  if (process.env.VERCEL === "1") return "unsupported-host";
  if (!streams.length) return "invalid-markets";
  if (streams.some(stream => CANDLE_MARKETS[stream.market].provider !== "binance") && !process.env.TWELVEDATA_API_KEY?.trim()) return "needs-data-config";
  const worker = globalThis.__rfxTelegramSignalWorker;
  if (worker === "disabled") return "starting";
  return worker ? "active" : "starting";
}
