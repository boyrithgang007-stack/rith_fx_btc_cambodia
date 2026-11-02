import { createHash } from "node:crypto";
import { aggregateCandles, evaluateConfirmedSignal, hasContinuousCandles } from "../../strategy";
import {
  BinanceFuturesTestnet,
  EaExchangeError,
  phnomPenhDayStart,
  type FuturesAccount,
} from "./binance-futures";
import { decideEaOrder } from "./risk";
import {
  claimEaRun,
  disableEa,
  getEaCredentials,
  hasEaRun,
  listEnabledEaUsers,
  updateEaRun,
  type EaSettings,
  type EaSymbol,
} from "./store";

const BASE_INTERVAL = 4 * 60 * 60 * 1000;
const HIGHER_INTERVAL = 24 * 60 * 60 * 1000;
const POLL_INTERVAL = 30_000;

function clientOrderId(userId: string, symbol: EaSymbol, candleTime: number, suffix: string) {
  const digest = createHash("sha256").update(`${userId}:${symbol}:${candleTime}`).digest("hex").slice(0, 20);
  return `RFX${digest}${suffix}`;
}

function safeMessage(error: unknown) {
  return error instanceof EaExchangeError ? error.message : "កំហុសប្រព័ន្ធ EA។ សូមពិនិត្យ log របស់ server។";
}

async function closeAfterProtectionFailure(
  client: BinanceFuturesTestnet,
  userId: string,
  symbol: EaSymbol,
  side: "BUY" | "SELL",
  quantity: number,
  stopOrderId: string,
  takeProfitOrderId: string,
  emergencyOrderId: string,
) {
  const cancel = async (id: string) => {
    try { await client.cancelOrder(symbol, id); return true; } catch { return false; }
  };
  const [stopCancelled, takeProfitCancelled] = await Promise.all([cancel(stopOrderId), cancel(takeProfitOrderId)]);
  try {
    const close = await client.closeMarketPosition(symbol, side, quantity, emergencyOrderId);
    const orderExecuted = (close.status === "FILLED" || Number(close.executedQty) > 0) && Number(close.executedQty) > 0;
    if (!orderExecuted) return { closed: false, protectionCancelled: stopCancelled && takeProfitCancelled };
    const account = await client.getAccount();
    const remainsOpen = account.positions.some(position => position.symbol === symbol && Math.abs(position.positionAmt) > 1e-12);
    return { closed: !remainsOpen, protectionCancelled: stopCancelled && takeProfitCancelled };
  } catch {
    await disableEa(userId, "ea.halted.emergency_close_failed");
    return { closed: false, protectionCancelled: stopCancelled && takeProfitCancelled };
  }
}

async function processUser(userId: string, symbol: EaSymbol, settings: EaSettings) {
  const credentials = await getEaCredentials(userId);
  if (!credentials) {
    await disableEa(userId, "ea.halted.credentials_missing");
    return;
  }
  const client = new BinanceFuturesTestnet(credentials);
  let account: FuturesAccount;
  try {
    account = await client.verifyAccount();
  } catch (error) {
    if (error instanceof EaExchangeError && error.message.includes("one-way position mode")) {
      await disableEa(userId, "ea.halted.position_mode");
      console.error("[ea-worker] EA stopped: Binance Futures position mode changed.");
      return;
    }
    throw error;
  }
  if (account.positions.some(position => position.positionAmt !== 0 && position.positionSide !== "BOTH")) {
    await disableEa(userId, "ea.halted.position_mode");
    console.error("[ea-worker] EA stopped: Binance Futures position mode changed.");
    return;
  }
  const now = Date.now();
  const equity = account.totalWalletBalance + account.totalUnrealizedProfit;
  const realizedPnl = await client.getDailyRealizedPnl(phnomPenhDayStart(now), now);
  const dailyPnl = realizedPnl + account.totalUnrealizedProfit;
  const startOfDayEquity = equity - dailyPnl;
  if (!Number.isFinite(startOfDayEquity) || startOfDayEquity <= 0) {
    await disableEa(userId, "ea.halted.daily_equity_invalid");
    console.error("[ea-worker] EA stopped: daily starting equity could not be verified.");
    return;
  }
  if (dailyPnl <= -(startOfDayEquity * 0.03)) {
    await disableEa(userId, "ea.halted.daily_loss_limit");
    console.error("[ea-worker] EA stopped: daily loss limit reached.");
    return;
  }

  const candles = await client.getCandles(symbol);
  if (!hasContinuousCandles(candles, BASE_INTERVAL) || candles.length < 20) return;
  const candleTime = candles.at(-1)!.time;
  if (Date.now() - candleTime > BASE_INTERVAL + 15 * 60_000 || await hasEaRun(userId, symbol, candleTime)) return;
  const higher = aggregateCandles(candles, BASE_INTERVAL, HIGHER_INTERVAL);
  const signal = evaluateConfirmedSignal(candles, settings.capitalUsd, settings.riskPercent, 2, {
    candles: higher,
    intervalMs: HIGHER_INTERVAL,
    baseIntervalMs: BASE_INTERVAL,
  }, 10);
  if (signal.action === "WAIT") return;

  const runId = await claimEaRun(userId, symbol, candleTime);
  if (!runId) return;
  try {
    const [markPrice, rules] = await Promise.all([client.getMarkPrice(symbol), client.getSymbolRules(symbol)]);
    const decision = decideEaOrder({ signal, settings, account, baselineEquity: startOfDayEquity, markPrice, rules });
    if (!decision.allowed) {
      await updateEaRun(runId, "skipped", decision.reason);
      return;
    }

    await client.setLeverage(symbol, settings.leverage);
    const entryId = clientOrderId(userId, symbol, candleTime, "E");
    let entry;
    try {
      entry = await client.placeMarketOrder(symbol, signal.action, decision.quantity, entryId);
    } catch {
      try {
        entry = await client.findOrder(symbol, entryId);
      } catch {
        await disableEa(userId, "ea.halted.order_status_unknown");
        await updateEaRun(runId, "halted", "មិនអាចបញ្ជាក់ស្ថានភាព entry order បានទេ។ EA ត្រូវបានបិទដើម្បីការពារ order ស្ទួន។");
        return;
      }
    }

    const executedQuantity = Number(entry.executedQty);
    if (!Number.isFinite(executedQuantity) || executedQuantity <= 0) {
      try {
        await client.cancelOrder(symbol, entryId);
        await updateEaRun(runId, "failed", "Binance មិនបានបំពេញ entry order ហើយ order ត្រូវបានលុប។", String(entry.orderId));
      } catch {
        await disableEa(userId, "ea.halted.entry_order_cancel_failed");
        await updateEaRun(runId, "halted", "Entry order មិនបានបញ្ជាក់ថាបានបំពេញ ឬលុបទេ។ សូមពិនិត្យ Testnet ភ្លាមៗ។", String(entry.orderId));
      }
      return;
    }
    const fillPrice = Number(entry.avgPrice);
    const actualEntry = fillPrice;
    const isLong = signal.action === "BUY";
    const stopSide = isLong ? "SELL" : "BUY";
    const stopDistance = Math.abs(actualEntry - decision.stopLoss);
    const takeProfit = actualEntry + (isLong ? 1 : -1) * stopDistance * 2;
    const stopId = clientOrderId(userId, symbol, candleTime, "S");
    const takeProfitId = clientOrderId(userId, symbol, candleTime, "T");
    if (!Number.isFinite(actualEntry) || actualEntry <= 0 || stopDistance <= 0 || takeProfit <= 0 || (isLong ? decision.stopLoss >= actualEntry : decision.stopLoss <= actualEntry)) {
      const closed = await closeAfterProtectionFailure(client, userId, symbol, stopSide, executedQuantity, stopId, takeProfitId, clientOrderId(userId, symbol, candleTime, "X"));
      await disableEa(userId, "ea.halted.invalid_protection_levels");
      await updateEaRun(runId, "halted", closed.closed ? "Fill price ប្រែប្រួល។ Position ត្រូវបានបិទ និង EA ត្រូវបានបិទ។" : "Fill price ប្រែប្រួល ហើយការបិទ position មិនទាន់បញ្ជាក់បានទេ។ សូមពិនិត្យ Testnet ភ្លាមៗ។", String(entry.orderId));
      return;
    }

    const actualRisk = executedQuantity * (stopDistance + (actualEntry + decision.stopLoss) * 0.001);
    if (actualRisk > settings.capitalUsd * settings.riskPercent / 100 + 1e-8) {
      const closed = await closeAfterProtectionFailure(client, userId, symbol, stopSide, executedQuantity, stopId, takeProfitId, clientOrderId(userId, symbol, candleTime, "X"));
      await disableEa(userId, "ea.halted.risk_overrun");
      await updateEaRun(runId, "halted", closed.closed ? "Fill price ធ្វើឲ risk លើសកម្រិត។ Position ត្រូវបានបិទ ហើយ EA ត្រូវបានបិទ។" : "Fill price ធ្វើឲ risk លើសកម្រិត ហើយការបិទ position មិនទាន់បញ្ជាក់បានទេ។ សូមពិនិត្យ Testnet ភ្លាមៗ។", String(entry.orderId));
      return;
    }

    try {
      await client.placeCloseProtection(symbol, stopSide, "STOP_MARKET", decision.stopLoss, rules.tickSize, stopId);
      await client.placeCloseProtection(symbol, stopSide, "TAKE_PROFIT_MARKET", takeProfit, rules.tickSize, takeProfitId);
      if (!(await client.verifyCloseProtection(symbol, stopId, takeProfitId))) {
        throw new EaExchangeError("Binance Futures did not confirm both protective orders.");
      }
    } catch {
      const closed = await closeAfterProtectionFailure(
        client, userId, symbol, stopSide, executedQuantity, stopId, takeProfitId, clientOrderId(userId, symbol, candleTime, "X"),
      );
      await disableEa(userId, "ea.halted.protection_order_failure");
      await updateEaRun(
        runId,
        "halted",
        closed.closed && closed.protectionCancelled
          ? "មិនអាចដាក់ SL/TP ទាំងពីរបាន។ Position ត្រូវបានបិទ និង EA ត្រូវបានបិទ។"
          : closed.closed
            ? "Position ត្រូវបានបិទ ប៉ុន្តែមិនអាចផ្ទៀងផ្ទាត់ការលុប SL/TP order បានទេ។ សូមពិនិត្យ Testnet ដោយដៃ។ EA ត្រូវបានបិទ។"
            : "មិនអាចផ្ទៀងផ្ទាត់ការការពារ ឬបិទ position បានទេ។ សូមពិនិត្យ Binance Futures Testnet ដោយដៃភ្លាមៗ។ EA ត្រូវបានបិទ។",
        String(entry.orderId),
      );
      return;
    }
    await updateEaRun(runId, "opened", `${signal.action} បានដាក់លើ Testnet ជាមួយ SL និង TP 1:2។`, String(entry.orderId));
  } catch (error) {
    await updateEaRun(runId, "failed", safeMessage(error));
    console.error("[ea-worker] Testnet execution failed:", error instanceof Error ? error.message : "Unknown error");
  }
}

export async function runEaPass() {
  const enabledUsers = await listEnabledEaUsers();
  for (const user of enabledUsers) {
    try {
      await processUser(user.userId, user.symbol, {
        symbol: user.symbol,
        capitalUsd: user.capitalCents / 100,
        riskPercent: user.riskTenths / 10,
        leverage: user.leverage,
        enabled: true,
        updatedAt: null,
      });
    } catch (error) {
      console.error("[ea-worker] Testnet polling failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }
}

declare global {
  var __rfxEaWorker: NodeJS.Timeout | undefined;
}

export function startEaWorker() {
  if (process.env.NODE_ENV === "test" || process.env.VERCEL === "1" || globalThis.__rfxEaWorker) return;
  const tick = () => { void runEaPass().catch(error => console.error("[ea-worker] EA pass failed:", error instanceof Error ? error.message : "Unknown error")); };
  globalThis.__rfxEaWorker = setInterval(tick, POLL_INTERVAL);
  globalThis.__rfxEaWorker.unref();
  tick();
}
