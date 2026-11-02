import type { Signal } from "../../strategy";
import type { FuturesAccount, SymbolRules } from "./binance-futures";
import { floorToStep } from "./binance-futures";
import type { EaSettings } from "./store";

export type EaOrderDecision =
  | { allowed: true; quantity: number; notional: number; stopLoss: number; takeProfit: number; dailyPnl: number }
  | { allowed: false; reason: string; dailyPnl: number };

export function decideEaOrder(input: {
  signal: Signal;
  settings: EaSettings;
  account: FuturesAccount;
  baselineEquity: number;
  markPrice: number;
  rules: SymbolRules;
}): EaOrderDecision {
  const { signal, settings, account, baselineEquity, markPrice, rules } = input;
  const equity = account.totalWalletBalance + account.totalUnrealizedProfit;
  const dailyPnl = equity - baselineEquity;
  const block = (reason: string): EaOrderDecision => ({ allowed: false, reason, dailyPnl });

  if (!Number.isFinite(equity) || equity <= 0 || !Number.isFinite(baselineEquity) || baselineEquity <= 0) return block("មិនអាចផ្ទៀងផ្ទាត់ equity ប្រចាំថ្ងៃបានទេ។");
  if (dailyPnl <= -(baselineEquity * 0.03)) return block("ឈានដល់ daily loss limit 3% — EA ត្រូវបិទ។");
  if (dailyPnl <= 0) return block("មិនបើក order ថ្មីទេ៖ PnL ប្រចាំថ្ងៃមិនទាន់វិជ្ជមាន។");
  if (account.positions.some(position => position.positionAmt !== 0)) return block("មាន position បើករួចនៅក្នុង Futures account — មិនបើក position បន្ថែមទេ។");
  if (signal.action === "WAIT" || signal.entry === null || signal.stopLoss === null || signal.takeProfit === null) return block("គ្មានសញ្ញា candle បិទដែលបានបញ្ជាក់។");
  if (!Number.isFinite(markPrice) || markPrice <= 0 || Math.abs(markPrice - signal.entry) / signal.entry > 0.005) return block("តម្លៃ Futures ប្រែប្រួលលើស 0.5% ពីសញ្ញា — រង់ចាំ candle ថ្មី។");
  if (!Number.isFinite(settings.capitalUsd) || settings.capitalUsd <= 0 || !Number.isInteger(settings.leverage) || settings.leverage < 1 || settings.leverage > 5
    || !Number.isFinite(settings.riskPercent) || settings.riskPercent <= 0 || settings.riskPercent > 1) return block("ការកំណត់ដើមទុន ឬហានិភ័យមិនត្រឹមត្រូវ។");
  if (!Number.isFinite(account.availableBalance) || account.availableBalance <= 0) return block("មិនមាន available margin សម្រាប់ order ទេ។");

  const isLong = signal.action === "BUY";
  const distance = Math.abs(markPrice - signal.stopLoss);
  if (distance <= 0 || (isLong ? signal.stopLoss >= markPrice : signal.stopLoss <= markPrice)) return block("Stop-loss មិនស្ថិតនៅទិសដៅត្រឹមត្រូវទេ។");
  const expectedTarget = markPrice + (isLong ? 1 : -1) * distance * 2;
  if (expectedTarget <= 0) return block("Take-profit គណនាមិនត្រឹមត្រូវ។");
  const maxRisk = settings.capitalUsd * settings.riskPercent / 100;
  const maxNotional = Math.min(settings.capitalUsd, account.availableBalance) * settings.leverage;
  const riskPerUnit = distance + (markPrice + signal.stopLoss) * 0.001;
  const quantity = floorToStep(Math.min(maxRisk / riskPerUnit, maxNotional / markPrice), rules.stepSize);
  const notional = quantity * markPrice;
  if (!Number.isFinite(quantity) || quantity < rules.minQty || notional < rules.minNotional || notional <= 0) {
    return block("ទំហំ order ទាបជាង minimum របស់ Binance Futures ឬ account margin មិនគ្រប់។");
  }
  if (quantity * riskPerUnit > maxRisk + 1e-8 || notional / settings.leverage > account.availableBalance + 1e-8) {
    return block("Order លើសកម្រិតហានិភ័យ ឬ available margin។");
  }
  return {
    allowed: true,
    quantity,
    notional,
    stopLoss: signal.stopLoss,
    takeProfit: expectedTarget,
    dailyPnl,
  };
}
