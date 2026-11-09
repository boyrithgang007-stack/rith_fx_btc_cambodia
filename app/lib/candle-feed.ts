import { CANDLE_MARKETS, CANDLE_FRAMES, type CandleMarket, type CandleFrame } from "../candle-markets";
import { validCandles, type Candle } from "../strategy";
export class CandleFeedError extends Error { constructor(message:string,public status=502){super(message);} }
export function parseBinanceCandles(payload:unknown,intervalMs:number,now:number):Candle[] {
  if(!Array.isArray(payload)||payload.length>1000)throw new CandleFeedError("Invalid Binance candle response.");
  const candles:Candle[]=[];
  for(const row of payload) {
    if(!Array.isArray(row)||row.length<7||!Number.isSafeInteger(row[0])||!Number.isSafeInteger(row[6])||row[6]+1-row[0]!==intervalMs)throw new CandleFeedError("Unexpected candle interval.");
    const [open,high,low,close,volume]=row.slice(1,6).map(Number);
    if(row.slice(1,6).some(v=>typeof v!=="string"&&typeof v!=="number")||![open,high,low,close,volume].every(Number.isFinite)||volume<0)throw new CandleFeedError("Invalid candle values.");
    if(row[0]>now)throw new CandleFeedError("Future candle data rejected.");
    if(row[6]+1<=now){const takerBuyVolume=row.length>9?Number(row[9]):undefined;if(takerBuyVolume!==undefined&&(!Number.isFinite(takerBuyVolume)||takerBuyVolume<0||takerBuyVolume>volume))throw new CandleFeedError("Invalid Binance taker buy volume.");candles.push({time:row[6]+1,open,high,low,close,volume,...(takerBuyVolume===undefined?{}:{takerBuyVolume})});}
  }
  if(!validCandles(candles))throw new CandleFeedError("Invalid candle ordering or OHLC bounds.");
  return candles;
}
export function parseTwelveCandles(payload:unknown,symbol:string,frame:CandleFrame,now:number):Candle[] {
  const data=payload as {meta?:{symbol?:string;interval?:string};values?:Array<{datetime:string;open:string;high:string;low:string;close:string;volume?:string}>;status?:string};
  if(!data||data.status!=="ok"||data.meta?.symbol!==symbol||data.meta?.interval!==CANDLE_FRAMES[frame].td||!Array.isArray(data.values)||data.values.length>500)throw new CandleFeedError("Twelve Data response missing, denied by plan, or mismatched. Check symbol permissions.");
  const candles=data.values.map(row=>{
    if(!row||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.datetime))throw new CandleFeedError("Invalid UTC candle timestamp.");
    const time=Date.parse(row.datetime.replace(" ","T")+"Z")+CANDLE_FRAMES[frame].ms;
    if(time-CANDLE_FRAMES[frame].ms>now)throw new CandleFeedError("Future candle data rejected.");
    const values=[row.open,row.high,row.low,row.close].map(Number);
    if([row.open,row.high,row.low,row.close].some(v=>typeof v!=="string"||!v.trim())||!values.every(Number.isFinite))throw new CandleFeedError("Invalid OHLC values.");
    const volume=row.volume===undefined?0:Number(row.volume);
    if(!Number.isFinite(volume)||volume<0)throw new CandleFeedError("Invalid candle volume.");
    return {time,open:values[0],high:values[1],low:values[2],close:values[3],volume};
  }).filter(row=>row.time<=now).sort((a,b)=>a.time-b.time);
  if(!validCandles(candles))throw new CandleFeedError("Invalid candle ordering or OHLC bounds.");
  return candles;
}
export async function loadCandleFeed(market:CandleMarket,frame:CandleFrame,now:number,fetcher:typeof fetch=fetch) {
  const instrument=CANDLE_MARKETS[market];
  let url:URL;
  if(instrument.provider==="binance") {
    url=new URL("https://data-api.binance.vision/api/v3/klines");
    url.search=new URLSearchParams({symbol:instrument.symbol,interval:frame,limit:"300"}).toString();
  } else {
    const key=process.env.TWELVEDATA_API_KEY?.trim();
    if(!key)throw new CandleFeedError("Set TWELVEDATA_API_KEY on the server for Forex, gold, silver and oil candles. TradingView widget data cannot be extracted.",503);
    url=new URL("https://api.twelvedata.com/time_series");
    url.search=new URLSearchParams({symbol:instrument.symbol,interval:CANDLE_FRAMES[frame].td,outputsize:"300",timezone:"UTC",order:"ASC",apikey:key}).toString();
  }
  const response=await fetcher(url,{cache:"no-store",signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!response.ok)throw new CandleFeedError("Candle provider unavailable or rate limited. Retry later.");
  const payload=await response.json();
  return {candles:instrument.provider==="binance"?parseBinanceCandles(payload,CANDLE_FRAMES[frame].ms,now):parseTwelveCandles(payload,instrument.symbol,frame,now),source:instrument.provider==="binance"?"Binance public spot OHLC":"Twelve Data aggregated OHLC",volumeAvailable:instrument.provider==="binance"};
}
