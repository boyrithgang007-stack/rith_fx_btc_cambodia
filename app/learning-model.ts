export type LessonCandle = { open: number; high: number; low: number; close: number };
export function candleDirection(candle: LessonCandle) {
  if (![candle.open,candle.high,candle.low,candle.close].every(value=>Number.isFinite(value)&&value>0)
    || candle.low>Math.min(candle.open,candle.close)||candle.high<Math.max(candle.open,candle.close)) throw new Error("Invalid candle");
  return candle.close>candle.open ? "up" : candle.close<candle.open ? "down" : "flat";
}
export function lessonRisk(capital: number, percent: number, entry: number, stop: number) {
  if (![capital,percent,entry,stop].every(Number.isFinite)||capital<=0||percent<=0||percent>100||entry<=0||stop<=0||stop>=entry) return null;
  const budget=capital*(percent/100), distance=entry-stop;
  const quantity=Math.min(budget/distance,capital/entry);
  const exposure=quantity*entry, plannedLoss=quantity*distance;
  if (![budget,distance,quantity,exposure,plannedLoss].every(Number.isFinite)) return null;
  return { budget, distance, quantity, exposure, plannedLoss };
}
export const LEARNING_SOURCES = [
  { title:"CME Group · Chart types and OHLC", url:"https://www.cmegroup.com/education/courses/trading-and-analysis/technical-analysis" },
  { title:"Investor.gov · Forex and leverage", url:"https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/foreign" },
];
