import type {Candle} from "../strategy";
import {CANDLE_FRAMES,type CandleFrame} from "../candle-markets";
export function parseStreamCandle(value:unknown,symbol:string,frame:CandleFrame,now:number){
  const v=value as {e?:string;E?:number;s?:string;k?:{s?:string;i?:string;t?:number;T?:number;x?:boolean;o?:string;h?:string;l?:string;c?:string;v?:string}};
  const k=v?.k;
  if(v?.e!=="kline"||v.s!==symbol||!k||k.s!==symbol||k.i!==frame||typeof k.x!=="boolean"||!Number.isSafeInteger(v.E)||!Number.isSafeInteger(k.t)||!Number.isSafeInteger(k.T))return null;
  if(v.E!>now+5000||now-v.E!>15000||k.T!+1-k.t! !==CANDLE_FRAMES[frame].ms)return null;
  if(k.x&&k.T!+1>now+1000)return null;
  const values=[k.o,k.h,k.l,k.c,k.v];
  if(values.some(x=>typeof x!=="string"||!x.trim()))return null;
  const [open,high,low,close,volume]=values.map(Number);
  if(![open,high,low,close,volume].every(Number.isFinite)||low<=0||volume<0||high<Math.max(open,close)||low>Math.min(open,close))return null;
  const candle:Candle={time:k.T!+1,open,high,low,close,volume};
  return {candle,closed:k.x,eventTime:v.E!};
}
