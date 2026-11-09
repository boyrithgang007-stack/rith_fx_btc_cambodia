"use client";
import {useEffect,useState} from "react";
import type {CandleAnalysisReport} from "./candle-types";
import {CANDLE_FRAMES,CANDLE_MARKETS,type CandleMarket,type CandleFrame} from "./candle-markets";
import {parseStreamCandle} from "./lib/binance-stream";
import {closedCandleSignal} from "./lib/candle-signal";
export function useBinanceStream(market:CandleMarket,frame:CandleFrame,rr:2|3,enabled:boolean){
  const key=`${market}:${frame}:${rr}`;
  const [state,setState]=useState<{key:string;report:CandleAnalysisReport|null;status:string;price:number|null;age:number|null}>({key:"",report:null,status:"Off",price:null,age:null});
  useEffect(()=>{
    if(!enabled||CANDLE_MARKETS[market].provider!=="binance")return;
    let stopped=false,socket:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|undefined,lastEvent=0,lastDisplay=0;
    let candles:CandleAnalysisReport["candles"]=[];
    const abort=new AbortController();
    const update=(status:string)=>{if(!stopped)setState(s=>({...s,key,status}));};
    async function connect(){
      update("Synchronizing closed candles");
      try{
        const r=await fetch("/api/candle-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({market,frame,rewardRatio:rr,includeAi:false}),signal:abort.signal});
        if(!r.ok)throw Error("Seed unavailable / rate limited");
        const seed=await r.json() as CandleAnalysisReport;
        if(stopped)return;
        if(seed.market!==market||seed.frame!==frame||!Array.isArray(seed.candles)||seed.candles.length<60)throw Error();
        candles=seed.candles;setState({key,report:seed,status:"Connecting stream",price:null,age:null});
        lastEvent=Date.now();
        socket=new WebSocket(`wss://data-stream.binance.vision/ws/${CANDLE_MARKETS[market].symbol.toLowerCase()}@kline_${frame}`);
        socket.onmessage=event=>{
          if(stopped)return;
          try{
            const now=Date.now(),tick=parseStreamCandle(JSON.parse(event.data),CANDLE_MARKETS[market].symbol,frame,now);
            if(!tick||tick.eventTime<lastEvent)return;lastEvent=tick.eventTime;
            if(now-lastDisplay>500){lastDisplay=now;setState(s=>({...s,status:"Streaming",price:tick.candle.close,age:now-tick.eventTime}));}
            if(!tick.closed||tick.candle.time<=candles.at(-1)!.time)return;
            if(tick.candle.time-candles.at(-1)!.time!==CANDLE_FRAMES[frame].ms){socket?.close();return;}
            candles=[...candles,tick.candle].slice(-300);
            const checked=closedCandleSignal(candles,CANDLE_FRAMES[frame].ms,now,rr);
            const signal=checked.signal;
            const report:CandleAnalysisReport={...seed,id:`stream:${key}`,source:"Binance Spot WebSocket · technical",generatedAt:now,asOf:tick.candle.time,expiresAt:checked.expiresAt,candles,ema:checked.analysis?.ema??[],trend:checked.analysis?.trend??"UNAVAILABLE",signal,ai:{status:"not_requested",consistent:null,summary:"Technical signal recalculated at candle close. Additional review was not requested.",risks:[],observations:[]}};
            setState(s=>({...s,report,status:"Streaming",price:tick.candle.close,age:now-tick.eventTime}));
          }catch{update("Invalid stream message ignored");}
        };
        socket.onerror=()=>update("Stream connection error");
        socket.onclose=()=>{if(!stopped){update("Disconnected · resync in 30s");retry=setTimeout(()=>void connect(),30000);}};
      }catch{if(!stopped){update("Feed unavailable · retry in 30s");retry=setTimeout(()=>void connect(),30000);}}
    }
    void connect();
    const watchdog=setInterval(()=>{if(lastEvent&&Date.now()-lastEvent>15000){update("Stale stream · no fresh updates");if(socket&&socket.readyState<=WebSocket.OPEN)socket.close();}},5000);
    return()=>{stopped=true;abort.abort();clearTimeout(retry);clearInterval(watchdog);socket?.close();};
  },[market,frame,rr,enabled,key]);
  return enabled&&state.key===key?state:{key,report:null,status:enabled?"Connecting":"Off",price:null,age:null};
}
