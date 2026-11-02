"use client";
import {useEffect,useRef,useState} from "react";
import {CANDLE_MARKETS,CANDLE_FRAMES,type CandleMarket,type CandleFrame} from "./candle-markets";
export default function TradingViewChart({market,frame,theme}:{market:CandleMarket;frame:CandleFrame;theme:"light"|"dark"}){
  const ref=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const host=ref.current;if(!host)return;
    let active=true;
    const wrapper=document.createElement("div");wrapper.className="tradingview-widget-container";wrapper.style.height="100%";
    const widget=document.createElement("div");widget.className="tradingview-widget-container__widget";widget.style.height="100%";
    const script=document.createElement("script");script.type="text/javascript";script.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";script.async=true;
    script.textContent=JSON.stringify({autosize:true,symbol:CANDLE_MARKETS[market].tv,interval:CANDLE_FRAMES[frame].tv,timezone:"Asia/Bangkok",theme,style:"1",locale:"en",allow_symbol_change:false,hide_side_toolbar:false,calendar:false,save_image:false,withdateranges:true,support_host:"https://www.tradingview.com"});
    script.onerror=()=>{if(active)setFailed(true);};wrapper.append(widget,script);host.append(wrapper);
    return()=>{active=false;wrapper.remove();};
  },[market,frame,theme]);
  return <div className="tv-chart-block"><div ref={ref} className="tv-chart-host"/>{failed&&<p role="status">TradingView មិនអាចបើកបាន។ សូមពិនិត្យ network ឬបើកតំណខាងក្រោម។</p>}<a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(CANDLE_MARKETS[market].tv)}`} target="_blank" rel="noreferrer">{CANDLE_MARKETS[market].label} chart by TradingView ↗</a><p>TradingView បង្ហាញក្រាបផ្ទាល់ខ្លួន។ ការវិភាគប្រើ OHLC ពីប្រភពដែលបញ្ជាក់ក្នុងលទ្ធផល ដូច្នេះតម្លៃអាចខុសគ្នាតាម provider។</p></div>;
}
