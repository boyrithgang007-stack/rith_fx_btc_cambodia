"use client";

import ControlButton from "./ControlButton";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type IconName = "home" | "markets" | "forex" | "search" | "account" | "plus";
function Icon({name}:{name:IconName}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name==="home" && <path className="dock-home-shape" d="m3 10 7-6a3 3 0 0 1 4 0l7 6v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>}
    {name==="markets" && <><rect x="3" y="4" width="16" height="13" rx="3"/><path d="M7 20h11a4 4 0 0 0 4-4V8M6 8h1m8 5h1"/><circle cx="11" cy="10.5" r="2.5"/></>}
    {name==="forex" && <><path d="M19 7V5a2 2 0 0 0-2-2H7a4 4 0 0 0-4 4v11a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2H7"/><path d="M21 11h-5a3 3 0 0 0 0 6h5"/><path d="M16 14h.01"/></>}
    {name==="search" && <><circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/></>}
    {name==="account" && <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>}
    {name==="plus" && <path d="M12 4v16M4 12h16"/>}
  </svg>;
}
const dashboardItems = [{id:"overview",path:"/markets/overview",icon:"home",label:"Home"},{id:"assets",path:"/markets/assets",icon:"markets",label:"Markets"},{id:"forex",path:"/markets/forex",icon:"forex",label:"Forex"},{id:"account",path:"/accounts/balances",icon:"account",label:"Account"}] as const;
const homeItems = [{id:"home",icon:"home",label:"Home"},{id:"home-features",icon:"markets",label:"Explore"},{id:"account-access",icon:"account",label:"Account"}] as const;

export default function MobileDock({guest=false}:{guest?:boolean}) {
  const items = guest ? homeItems : dashboardItems;
  const pathname = usePathname();
  const [active,setActive]=useState<string>(items[0].id);
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const toggle=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const panelId=guest ? "home-quick-actions" : "market-quick-actions";
  useEffect(()=>{
    if (!guest) return;
    let frame=0;
    const update=()=>{frame=0;let current:string=items[0].id,nearest=-Infinity;for(const item of items){const top=document.getElementById(item.id)?.getBoundingClientRect().top;if(top!==undefined && top<=180 && top>nearest){nearest=top;current=item.id;}}setActive(current);};
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    window.addEventListener("scroll",scroll,{passive:true});update();
    return ()=>{window.removeEventListener("scroll",scroll);cancelAnimationFrame(frame);};
  },[items,guest]);
  useEffect(()=>{
    if(!open)return;
    panel.current?.querySelector<HTMLAnchorElement>("a")?.focus({preventScroll:true});
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);toggle.current?.focus({preventScroll:true});}};
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const wide=window.matchMedia("(min-width: 761px)");
    const resize=()=>{if(wide.matches)setOpen(false);};
    window.addEventListener("keydown",escape);document.addEventListener("pointerdown",outside);wide.addEventListener("change",resize);
    return ()=>{window.removeEventListener("keydown",escape);document.removeEventListener("pointerdown",outside);wide.removeEventListener("change",resize);};
  },[open]);
  const shortcuts=guest ? [{id:"home-features",href:"#home-features",name:"ស្វែងយល់ពីមុខងារ",detail:"CPI · Forex · Crypto"},{id:"account-access",href:"#account-access",name:"ចូលគណនី / ចុះឈ្មោះ",detail:"Open your workspace"}] : [
    {id:"macro",href:"/markets/macro",name:"ប្រតិទិន CPI",detail:"Next release & scenarios"},
    {id:"analytics",href:"/markets/charts",name:"ក្រាប និងទិន្នន័យ Crypto",detail:"ជ្រើស coin · history"},
    {id:"market-analysis",href:"/markets/analysis",name:"វិភាគទីផ្សារ",detail:"Crypto · Forex · សញ្ញាបច្ចេកទេស"},
    {id:"assets",href:"/markets/assets",name:"បញ្ជីទ្រព្យសកម្ម",detail:"Coins · search · favorites"},
    {id:"watchlist",href:"/markets/watchlist",name:"បញ្ជីចូលចិត្ត",detail:"Watchlist"},
    {id:"strategy",href:"/markets/strategy",name:"វិភាគទិន្នន័យ",detail:"Crypto · Forex · FVG & Order Blocks"},
    {id:"balances",href:"/accounts/balances",name:"សមតុល្យគណនី",detail:"Connected account balances"},
    {id:"exchanges",href:"/accounts/exchanges",name:"Exchange accounts",detail:"Binance · Bitget · OKX"},
    {id:"mt5",href:"/accounts/mt5",name:"Forex account · MT5",detail:"Broker bridge"},
    {id:"bank",href:"/accounts/bank",name:"គណនីធនាគារ",detail:"Open Banking"},
    {id:"settings",href:"/markets/settings",name:"ការកំណត់គណនី",detail:"Profile · password · appearance"},
    {id:"learn",href:"/learn",name:"សិក្សាទីផ្សារ",detail:"Interactive lessons · practice"},
  ];
  return <div className="floating-dock" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    {open && <div className="dock-shortcuts" id={panelId} ref={panel} role="region" aria-label="Quick actions"><p>ជម្រើសរហ័ស <span>QUICK ACTIONS</span></p>{shortcuts.map((item,i)=><a key={item.id} href={item.href} onClick={()=>{setOpen(false);toggle.current?.focus({preventScroll:true});}}><span className="shortcut-number">0{i+1}</span><span><b>{item.name}</b><small>{item.detail}</small></span><span aria-hidden="true">↗</span></a>)}</div>}
    <nav className="dock-pill" aria-label={guest?"Mobile home navigation":"Mobile dashboard navigation"}>
      {items.map(item=><a key={item.id} href={"path" in item ? item.path : `#${item.id}`} aria-label={item.label} title={item.label} aria-current={"path" in item ? (pathname===item.path?"page":undefined) : (active===item.id?"location":undefined)} onClick={()=>{setActive(item.id);setOpen(false);}}><Icon name={item.icon}/><span>{item.label}</span></a>)}
      {!guest && <ControlButton controlSize="icon" type="button" aria-label="ស្វែងរកកាក់" title="Search markets" onClick={()=>{setOpen(false);const input=document.getElementById("market-search");input?.scrollIntoView({block:"center"});input?.focus({preventScroll:true});}}><Icon name="search"/></ControlButton>}
    </nav>
    <ControlButton variant="primary" controlSize="icon-lg" ref={toggle} type="button" className="dock-add" aria-label={open?"បិទជម្រើសរហ័ស":"បើកជម្រើសរហ័ស"} aria-expanded={open} aria-controls={open?panelId:undefined} onClick={()=>setOpen(value=>!value)}><Icon name="plus"/></ControlButton>
  </div>;
}
