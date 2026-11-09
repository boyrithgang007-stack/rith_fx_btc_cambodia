import { execute, query } from "./database";

export async function reserveTelegramSignal(signalKey: string, market: string, frame: string, candleTime: number, direction: "BUY" | "SELL") {
  const now = Date.now();
  const rows = await query<{ signal_key: string }>(`INSERT INTO telegram_signal_deliveries
    (signal_key,market,frame,candle_time,direction,status,attempted_at)
    VALUES (?,?,?,?,?,'sending',?)
    ON CONFLICT(signal_key) DO UPDATE SET status='sending',attempted_at=EXCLUDED.attempted_at,last_error=NULL
    WHERE telegram_signal_deliveries.status='failed' AND telegram_signal_deliveries.attempted_at <= ?
    RETURNING signal_key`, [signalKey, market, frame, candleTime, direction, now, now - 60_000]);
  return rows.length > 0;
}

export function markTelegramSignalSent(signalKey: string, messageId: number) {
  const now = Date.now();
  return execute(`UPDATE telegram_signal_deliveries SET status='sent',sent_at=?,telegram_message_id=?,last_error=NULL WHERE signal_key=? AND status='sending'`, [now, messageId, signalKey]);
}

export function markTelegramSignalFailed(signalKey: string, reason: string) {
  return execute(`UPDATE telegram_signal_deliveries SET status='failed',last_error=? WHERE signal_key=? AND status='sending'`, [reason.slice(0, 300), signalKey]);
}

export function markTelegramSignalUnknown(signalKey: string) {
  return execute(`UPDATE telegram_signal_deliveries SET status='unknown',last_error=? WHERE signal_key=? AND status='sending'`, ["Telegram response was not confirmed; automatic retry suppressed to avoid a duplicate group message.", signalKey]);
}
