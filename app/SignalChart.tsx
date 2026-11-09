"use client";
import {useEffect,useRef} from "react";
import {createChart,CandlestickSeries,LineSeries,createSeriesMarkers,ColorType,LineStyle,type UTCTimestamp} from "lightweight-charts";
import {candleSignalMarkers} from "./lib/candle-signal";
import {CANDLE_FRAMES} from "./candle-markets";
import type {CandleAnalysisReport} from "./candle-types";
import {useAppTheme} from "./ThemeControls";

export default function SignalChart({report,active}:{report:CandleAnalysisReport;active:boolean}){
  const host=useRef<HTMLDivElement>(null),theme=useAppTheme();
  const error=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{
    if(!host.current||!report.candles.length)return;
    if(error.current)error.current.hidden=true;
    const dark=theme==="dark",text=dark?"#c9deef":"#24364b",grid=dark?"#203247":"#e2e8f0";
    const chart=createChart(host.current,{autoSize:true,height:480,layout:{background:{type:ColorType.Solid,color:dark?"#0a1625":"#f5f7fb"},textColor:text,attributionLogo:true},grid:{vertLines:{color:grid},horzLines:{color:grid}},timeScale:{timeVisible:true,secondsVisible:false,rightOffset:6},rightPriceScale:{borderColor:grid},localization:{locale:"en-GB",timeFormatter:(t:number)=>new Date(t*1000).toLocaleString("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}});
    try{
      const stamp=(n:number)=>Math.floor(n/1000) as UTCTimestamp;
      const series=chart.addSeries(CandlestickSeries,{upColor:"#20b98c",downColor:"#ee6176",wickUpColor:"#20b98c",wickDownColor:"#ee6176",borderVisible:false,priceFormat:{type:"price",precision:5,minMove:.00001}});
      series.setData(report.candles.map(c=>({...c,time:stamp(c.time)})));
      const ema=chart.addSeries(LineSeries,{color:"#e0b64f",lineWidth:2,priceLineVisible:false,lastValueVisible:false});
      if(report.ema.length===report.candles.length)ema.setData(report.ema.map((value,i)=>({time:stamp(report.candles[i].time),value})));
      const last=report.candles.at(-1)!.time;
      const history=candleSignalMarkers(report.candles,CANDLE_FRAMES[report.frame].ms,report.rewardRatio??2).filter(m=>m.time<last);
      const current=report.signal.action!=="WAIT"&&report.signal.entry!==null?[{time:last,action:report.signal.action}]:[];
      createSeriesMarkers(series,[...history,...current].map(m=>({time:stamp(m.time),position:m.action==="BUY"?"belowBar" as const:"aboveBar" as const,color:m.action==="BUY"?"#20b98c":"#ee6176",shape:m.action==="BUY"?"arrowUp" as const:"arrowDown" as const,text:m.time===last&&active?`${m.action} NOW`:m.action==="BUY"?"Buy":"Sell"})));
      if(report.signal.action!=="WAIT")for(const [title,price,color] of [["ENTRY",report.signal.entry,"#38bdf8"],["SL",report.signal.stopLoss,"#ee6176"],[`TP ${report.rewardRatio??2}R`,report.signal.takeProfit,"#20b98c"]] as const){
        if(price!==null)series.createPriceLine({price,color,lineWidth:2,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:active?title:`${title} (history)`});
      }
      chart.timeScale().setVisibleLogicalRange({from:Math.max(0,report.candles.length-65),to:report.candles.length+5});
    }catch{if(error.current)error.current.hidden=false;}
    return()=>chart.remove();
  },[report,active,theme]);
  return <figure className="interactive-signal-chart"><figcaption>{report.source} · {report.frame} · EMA20 · UTC+7 <strong>{active?report.signal.action:"HISTORICAL"}</strong></figcaption><div ref={host} className="signal-canvas" aria-label="Candlestick chart with Buy and Sell markers"/><p ref={error} hidden role="alert">Chart unavailable. Refresh this page.</p><p>Buy / Sell = historical technical setups. BUY NOW / SELL NOW = current reviewed result when available. Drag to pan; pinch or scroll to zoom.</p><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts powered by TradingView Lightweight Charts™</a></figure>;
}
