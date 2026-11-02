import type { Candle } from "../../strategy";

export const FOREX_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"] as const;
export type ForexSymbol = typeof FOREX_SYMBOLS[number];
export type ForexIndicatorName = "close" | "ema" | "rsi" | "atr";
export type ForexOperand = { indicator: ForexIndicatorName; period?: number } | { value: number };
export type ForexOperator = "above" | "below" | "crosses_above" | "crosses_below";
export type ForexCondition = { left: ForexOperand; operator: ForexOperator; right: ForexOperand };
export type ForexRule = {
  name: string;
  symbol: ForexSymbol;
  timeframe: "15m";
  higherTimeframe: "1h";
  buy: ForexCondition[];
  sell: ForexCondition[];
  stopAtr: number;
};
export type ForexSignal = {
  action: "BUY" | "SELL" | "WAIT";
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  reason: string;
  candleTime: number | null;
};

const indicators = new Set<ForexIndicatorName>(["close", "ema", "rsi", "atr"]);
const operators = new Set<ForexOperator>(["above", "below", "crosses_above", "crosses_below"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseOperand(value: unknown): ForexOperand | null {
  if (!isRecord(value)) return null;
  if (typeof value.value === "number") {
    return Number.isFinite(value.value) && value.value >= 0 && value.value <= 1_000_000_000
      ? { value: value.value }
      : null;
  }
  if (typeof value.indicator !== "string" || !indicators.has(value.indicator as ForexIndicatorName)) return null;
  const indicator = value.indicator as ForexIndicatorName;
  if (indicator === "close") return { indicator };
  if (!Number.isInteger(value.period) || (value.period as number) < 2 || (value.period as number) > 100) return null;
  return { indicator, period: value.period as number };
}

function parseCondition(value: unknown): ForexCondition | null {
  if (!isRecord(value) || typeof value.operator !== "string" || !operators.has(value.operator as ForexOperator)) return null;
  const left = parseOperand(value.left);
  const right = parseOperand(value.right);
  if (!left || !right || ("value" in left && "value" in right)) return null;
  return { left, operator: value.operator as ForexOperator, right };
}

export function parseForexRule(value: unknown): ForexRule | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 60
    || !FOREX_SYMBOLS.includes(value.symbol as ForexSymbol)
    || value.timeframe !== "15m"
    || value.higherTimeframe !== "1h"
    || typeof value.stopAtr !== "number" || !Number.isFinite(value.stopAtr) || value.stopAtr < 0.5 || value.stopAtr > 5
    || !Array.isArray(value.buy) || !Array.isArray(value.sell)
    || value.buy.length < 1 || value.buy.length > 10 || value.sell.length < 1 || value.sell.length > 10) return null;
  const buy = value.buy.map(parseCondition);
  const sell = value.sell.map(parseCondition);
  if (buy.some(condition => condition === null) || sell.some(condition => condition === null)) return null;
  return {
    name: value.name.trim(),
    symbol: value.symbol as ForexSymbol,
    timeframe: "15m",
    higherTimeframe: "1h",
    buy: buy as ForexCondition[],
    sell: sell as ForexCondition[],
    stopAtr: value.stopAtr,
  };
}

function ema(values: number[], period: number, index: number) {
  if (index + 1 < period) return null;
  const alpha = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i <= index; i++) result = values[i] * alpha + result * (1 - alpha);
  return result;
}

function rsi(candles: Candle[], period: number, index: number) {
  if (index < period) return null;
  let gain = 0, loss = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gain += Math.max(change, 0);
    loss += Math.max(-change, 0);
  }
  if (gain === 0 && loss === 0) return 50;
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

function atr(candles: Candle[], period: number, index: number) {
  if (index + 1 < period) return null;
  let total = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const previousClose = i > 0 ? candles[i - 1].close : candles[i].close;
    total += Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - previousClose), Math.abs(candles[i].low - previousClose));
  }
  return total / period;
}

function operandValue(operand: ForexOperand, candles: Candle[], index: number): number | null {
  if ("value" in operand) return operand.value;
  const candle = candles[index];
  if (!candle) return null;
  switch (operand.indicator) {
    case "close": return candle.close;
    case "ema": return ema(candles.map(item => item.close), operand.period!, index);
    case "rsi": return rsi(candles, operand.period!, index);
    case "atr": return atr(candles, operand.period!, index);
  }
}

function conditionMatches(condition: ForexCondition, candles: Candle[], index: number): boolean {
  const left = operandValue(condition.left, candles, index);
  const right = operandValue(condition.right, candles, index);
  if (left === null || right === null) return false;
  switch (condition.operator) {
    case "above": return left > right;
    case "below": return left < right;
    case "crosses_above": {
      if (index < 1) return false;
      const previousLeft = operandValue(condition.left, candles, index - 1);
      const previousRight = operandValue(condition.right, candles, index - 1);
      return previousLeft !== null && previousRight !== null && previousLeft <= previousRight && left > right;
    }
    case "crosses_below": {
      if (index < 1) return false;
      const previousLeft = operandValue(condition.left, candles, index - 1);
      const previousRight = operandValue(condition.right, candles, index - 1);
      return previousLeft !== null && previousRight !== null && previousLeft >= previousRight && left < right;
    }
  }
}

function completeHourlyCandles(candles: Candle[]) {
  const grouped = new Map<number, Candle[]>();
  const hourMs = 60 * 60 * 1000;
  for (const candle of candles) {
    const bucket = Math.floor((candle.time - 1) / hourMs) * hourMs;
    const group = grouped.get(bucket) ?? [];
    group.push(candle);
    grouped.set(bucket, group);
  }
  return [...grouped.entries()]
    .filter(([bucket, group]) => group.length === 4 && group.every((candle, index) =>
      candle.time === bucket + (index + 1) * 15 * 60 * 1000))
    .sort(([left], [right]) => left - right)
    .map(([bucket, group]) => ({
      time: bucket + hourMs,
      open: group[0].open,
      high: Math.max(...group.map(candle => candle.high)),
      low: Math.min(...group.map(candle => candle.low)),
      close: group[3].close,
      volume: group.reduce((total, candle) => total + candle.volume, 0),
    }));
}

export function evaluateForexRule(candles: Candle[], rule: ForexRule): ForexSignal {
  if (candles.length < 101 || candles.some((candle, index) =>
    ![candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    || candle.time <= 0 || candle.low <= 0 || candle.high < Math.max(candle.open, candle.close)
    || candle.low > Math.min(candle.open, candle.close)
    || (index > 0 && candle.time <= candles[index - 1].time))) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: "Forex 15m candles មិនគ្រប់ ឬមិនត្រឹមត្រូវ។", candleTime: null };
  }
  const index = candles.length - 1;
  const candle = candles[index];
  if (candle.time > Date.now() + 60_000 || Date.now() - candle.time > 2 * 60 * 60 * 1000) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: "Forex candle ចុងក្រោយចាស់ពេក ឬមានពេលអនាគត។", candleTime: candle.time };
  }
  const buy = rule.buy.every(condition => conditionMatches(condition, candles, index));
  const sell = rule.sell.every(condition => conditionMatches(condition, candles, index));
  if (buy === sell) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: buy ? "លក្ខខណ្ឌ BUY និង SELL បំពេញជាមួយគ្នា — ផ្អាក signal។" : "លក្ខខណ្ឌរូបមន្តមិនទាន់បំពេញ។", candleTime: candle.time };
  }
  const hourly = completeHourlyCandles(candles);
  if (hourly.length < 21) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: "ទិន្នន័យ 1h ដែលបិទហើយមិនគ្រប់សម្រាប់ trend confirmation។", candleTime: candle.time };
  }
  const hourlyIndex = hourly.length - 1;
  const hourlyEma = ema(hourly.map(item => item.close), 20, hourlyIndex);
  if (hourlyEma === null || (buy && hourly[hourlyIndex].close <= hourlyEma) || (sell && hourly[hourlyIndex].close >= hourlyEma)) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: "Signal មិនស្របនឹង trend 1h (Close ធៀប EMA20)។", candleTime: candle.time };
  }
  const action = buy ? "BUY" : "SELL";
  const volatility = atr(candles, 14, index);
  if (volatility === null || volatility <= 0) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: "មិនអាចគណនា ATR សម្រាប់ Stop-loss បានទេ។", candleTime: candle.time };
  }
  const distance = volatility * rule.stopAtr;
  const stopLoss = candle.close + (buy ? -distance : distance);
  const takeProfit = candle.close + (buy ? 2 * distance : -2 * distance);
  if (!Number.isFinite(stopLoss) || !Number.isFinite(takeProfit) || stopLoss <= 0 || takeProfit <= 0) {
    return { action: "WAIT", entry: null, stopLoss: null, takeProfit: null, reason: "តម្លៃ SL/TP មិនត្រឹមត្រូវ។", candleTime: candle.time };
  }
  return { action, entry: candle.close, stopLoss, takeProfit, reason: `${rule.name}: closed 15m conditions align with 1h Close/EMA20; TP is 2R.`, candleTime: candle.time };
}
