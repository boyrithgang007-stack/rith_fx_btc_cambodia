import type { Candle } from "../strategy";
export type MarketPressure = { buyPercent:number; sellPercent:number; basis:"taker-volume"|"candle-pressure"|"candle-pressure-no-volume"; candles:number };
export function marketPressure(candles:Candle[],windowSize=14):MarketPressure {
  const recent=candles.slice(-windowSize);
  if(!recent.length)return {buyPercent:50,sellPercent:50,basis:"candle-pressure-no-volume",candles:0};
  const hasTaker=recent.every(c=>Number.isFinite(c.takerBuyVolume));
  let buy=0,sell=0;
  for(const c of recent){
    if(hasTaker){buy+=c.takerBuyVolume!;sell+=Math.max(0,c.volume-c.takerBuyVolume!);continue;}
    const range=c.high-c.low;if(range<=0)continue;
    const weight=c.volume>0?c.volume:1;
    buy+=((c.close-c.low)/range)*weight;
    sell+=((c.high-c.close)/range)*weight;
  }
  const total=buy+sell;if(total<=0)return {buyPercent:50,sellPercent:50,basis:hasTaker?"taker-volume":"candle-pressure-no-volume",candles:recent.length};
  const buyPercent=Math.round((buy/total)*1000)/10;
  return {buyPercent,sellPercent:Math.round((100-buyPercent)*10)/10,basis:hasTaker?"taker-volume":recent.some(c=>c.volume>0)?"candle-pressure":"candle-pressure-no-volume",candles:recent.length};
}
export function takeProfitLevels(action:"BUY"|"SELL",entry:number,stopLoss:number){
  const risk=Math.abs(entry-stopLoss),direction=action==="BUY"?1:-1;
  return [1,2,3].map(ratio=>entry+direction*risk*ratio) as [number,number,number];
}