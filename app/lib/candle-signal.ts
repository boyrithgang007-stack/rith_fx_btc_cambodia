import { analyzeMarket, evaluateSignal, validCandles, type Candle, type Signal } from "../strategy";
/** Replay only closed prefixes: later candles cannot create earlier markers. */
export function candleSignalMarkers(candles:Candle[],intervalMs:number,rewardRatio:2|3=2) {
  const markers:{time:number;action:"BUY"|"SELL";entry:number;stopLoss:number;takeProfit:number}[]=[];
  for(let end=60;end<=candles.length;end++){
    const prefix=candles.slice(0,end),at=prefix.at(-1)!.time;
    const {signal}=closedCandleSignal(prefix,intervalMs,at,rewardRatio);
    if(signal.action!=="WAIT"&&signal.entry!==null&&signal.stopLoss!==null&&signal.takeProfit!==null)
      markers.push({time:at,action:signal.action,entry:signal.entry,stopLoss:signal.stopLoss,takeProfit:signal.takeProfit});
  }
  return markers;
}
export function closedCandleSignal(candles:Candle[],intervalMs:number,now:number,rewardRatio:2|3=2) {
  const fail=(reason:string)=>({action:"WAIT" as const,reason,zone:null,entry:null,stopLoss:null,takeProfit:null,quantity:0,riskAmount:0,notional:0,checks:[]});
  if(rewardRatio!==2&&rewardRatio!==3)return {signal:fail("Choose Risk:Reward 1:2 or 1:3."),analysis:null,expiresAt:null};
  const last=candles.at(-1);
  if(!validCandles(candles)||candles.length<60||!last||candles.some(c=>c.time>now)||!Number.isFinite(intervalMs)||intervalMs<=0)return {signal:fail("At least 60 valid closed candles are required."),analysis:null,expiresAt:null};
  const expiresAt=last.time+intervalMs;
  if(now>=expiresAt)return {signal:fail("Latest closed candle is stale or the market is closed. Refresh before considering a new setup."),analysis:null,expiresAt};
  const recent=candles.slice(-60);
  if(recent.some((c,i)=>i>0&&c.time-recent[i-1].time!==intervalMs))return {signal:fail("Recent candle history has gaps; no new entry signal."),analysis:null,expiresAt};
  const analysis=analyzeMarket(candles);
  const raw=evaluateSignal(candles,10000,1,rewardRatio,analysis);
  // WAIT never exposes pending entry/SL/TP as an actionable setup.
  const signal:Signal=raw.action==="WAIT"?{...raw,entry:null,stopLoss:null,takeProfit:null,quantity:0,riskAmount:0,notional:0}:raw;
  return {signal,analysis,expiresAt};
}
