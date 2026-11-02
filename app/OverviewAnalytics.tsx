"use client";

import ControlButton from "./ControlButton";

import { useId } from "react";
import { formatChange,formatCompactUsd,formatTerminalPrice,type TerminalAsset } from "./terminal-data";

export default function OverviewAnalytics({assets}:{assets:TerminalAsset[]}){
  const prefix=useId().replace(/:/g,"");
  const colors=["var(--chart-one,#a855f7)","var(--chart-two,#38bdf8)","var(--chart-three,#fb8a65)","var(--chart-four,#34cfa1)","var(--chart-five,#ec4899)"];
  const byCap=assets.filter(a=>Number.isFinite(a.market_cap)&&a.market_cap>0).sort((a,b)=>b.market_cap-a.market_cap);
  const total=byCap.reduce((sum,a)=>sum+a.market_cap,0);
  const slices=byCap.slice(0,4).map(a=>({name:a.symbol.toUpperCase(),value:a.market_cap}));
  if(byCap.length>4)slices.push({name:"Others",value:byCap.slice(4).reduce((sum,a)=>sum+a.market_cap,0)});
  const volumes=assets.filter(a=>Number.isFinite(a.total_volume)&&a.total_volume>0).sort((a,b)=>b.total_volume-a.total_volume).slice(0,6);
  const maxVolume=Math.max(1,...volumes.map(a=>a.total_volume));
  return <section className="td-bento-data" aria-label="Market comparison and reference asset details">
    <article className="td-panel glass-volume-panel"><div className="td-panel-heading"><div><span className="td-label">CATEGORY COMPARISON / USD</span><h2>24h volume leaders</h2></div><span className="glass-icon icon-coral" aria-hidden="true">▥</span></div>
      {volumes.length?<svg className="glass-volume-chart" viewBox="0 0 520 230" role="img" aria-label="Six highest reported asset volumes in US dollars">
        <defs><linearGradient id={`${prefix}-warm`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fb9b65"/><stop offset="1" stopColor="#ec4899"/></linearGradient><linearGradient id={`${prefix}-cool`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#38bdf8"/></linearGradient></defs>
        {[0,1,2].map(i=><line key={i} x1="20" x2="500" y1={35+i*70} y2={35+i*70} className="td-grid-line"/>)}
        {volumes.map((asset,i)=>{const height=asset.total_volume/maxVolume*145,x=28+i*80;return <g key={asset.id}><rect className="glass-bar" x={x} y={180-height} width="45" height={height} rx="12" fill={`url(#${prefix}-${i%2?"warm":"cool"})`} style={{animationDelay:`${i*55}ms`}}><title>{`${asset.name}: ${formatCompactUsd(asset.total_volume)} reported 24h volume`}</title></rect><text x={x+22} y="205" textAnchor="middle">{asset.symbol.toUpperCase()}</text><text x={x+22} y={Math.max(15,170-height)} textAnchor="middle">{formatCompactUsd(asset.total_volume)}</text></g>;})}
      </svg>:<div className="td-empty">Reported volume is not available.</div>}
      <p className="td-disclaimer">Provider-reported volume; not executed trades in your account.</p>
    </article>
    <article className="td-panel glass-allocation-panel"><div className="td-panel-heading"><div><span className="td-label">TRACKED CAPITALIZATION</span><h2>Market-cap composition</h2></div><span className="glass-icon icon-purple" aria-hidden="true">◉</span></div>
      {total>0?<div className="glass-donut-layout"><svg viewBox="0 0 200 200" className="glass-donut" role="img" aria-label="Market-cap shares within the tracked assets, not a personal portfolio"><circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth="24"/>{slices.map((slice,i)=>{const percent=slice.value/total*100,start=slices.slice(0,i).reduce((sum,item)=>sum+item.value,0)/total*100;return <circle key={slice.name} className="glass-donut-slice" cx="100" cy="100" r="72" fill="none" stroke={colors[i]} strokeWidth="24" pathLength="100" strokeDasharray={`${percent} ${100-percent}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{`${slice.name}: ${percent.toFixed(2)}%`}</title></circle>;})}<text x="100" y="97" textAnchor="middle">{assets.length} assets</text><text x="100" y="118" textAnchor="middle" className="glass-donut-total">{formatCompactUsd(total)}</text></svg><ul className="glass-donut-legend">{slices.map((slice,i)=><li key={slice.name}><i style={{background:colors[i]}}/><span>{slice.name}</span><b>{(slice.value/total*100).toFixed(1)}%</b></li>)}</ul></div>:<div className="td-empty">Market-cap data is not available.</div>}
      <p className="td-disclaimer">Shares of tracked assets only; not the entire market or your holdings.</p>
    </article>

  </section>;
}

export function ReferenceAssetDetails({assets,onSelect}:{assets:TerminalAsset[];onSelect:(id:string)=>void}){return (<article className="td-panel glass-reference-panel"><div className="td-panel-heading"><div><span className="td-label">REFERENCE DATA / OBSERVED ASSETS</span><h2>Asset details</h2></div><span className="glass-icon icon-blue" aria-hidden="true">▤</span></div><div className="glass-reference-scroll"><table><thead><tr><th>Asset</th><th>Price · USD</th><th>24h change</th><th>24h volume</th><th>Chart</th></tr></thead><tbody>{assets.map(asset=><tr key={asset.id}><td><b>{asset.symbol.toUpperCase()}</b><small>{asset.name}</small></td><td>{formatTerminalPrice(asset.current_price)}</td><td className={(asset.price_change_percentage_24h??0)<0?"td-red-text":"td-green-text"}>{formatChange(asset.price_change_percentage_24h)}</td><td>{formatCompactUsd(asset.total_volume)}</td><td><ControlButton type="button" onClick={()=>onSelect(asset.id)} aria-label={`Show ${asset.name} chart`}>View ↗</ControlButton></td></tr>)}{!assets.length&&<tr><td colSpan={5}>No reference assets loaded.</td></tr>}</tbody></table></div></article>);}
