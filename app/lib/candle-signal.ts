import { analyzeMarket, evaluateSignal, validCandles, type Candle, type Signal } from "../strategy";
export function closedCandleSignal(candles:Candle[],intervalMs:number,now:number) {
  const fail=(reason:string)=>({action:"WAIT" as const,reason,zone:null,entry:null,stopLoss:null,takeProfit:null,quantity:0,riskAmount:0,notional:0,checks:[]});
  const last=candles.at(-1);
  if(!validCandles(candles)||candles.length<60||!last||candles.some(c=>c.time>now)||!Number.isFinite(intervalMs)||intervalMs<=0)return {signal:fail("At least 60 valid closed candles are required."),analysis:null,expiresAt:null};
  const expiresAt=last.time+intervalMs;
  if(now>=expiresAt)return {signal:fail("Latest closed candle is stale or the market is closed. Refresh before considering a new setup."),analysis:null,expiresAt};
  const recent=candles.slice(-60);
  if(recent.some((c,i)=>i>0&&c.time-recent[i-1].time!==intervalMs))return {signal:fail("Recent candle history has gaps; no new entry signal."),analysis:null,expiresAt};
  const analysis=analyzeMarket(candles);
  const raw=evaluateSignal(candles,10000,1,2,analysis);
  // WAIT never exposes pending entry/SL/TP as an actionable setup.
  const signal:Signal=raw.action==="WAIT"?{...raw,entry:null,stopLoss:null,takeProfit:null,quantity:0,riskAmount:0,notional:0}:raw;
  return {signal,analysis,expiresAt};
}
