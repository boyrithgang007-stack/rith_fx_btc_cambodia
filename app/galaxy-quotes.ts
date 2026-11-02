import type { CommodityQuote, TerminalAsset } from "./terminal-data";
export type GalaxyQuote = { id:string; name:string; price:number|null; unit:string; source:string; asOf:number|null; timeLabel:string; stale:boolean };
export function buildGalaxyQuotes(assets:TerminalAsset[],commodities:CommodityQuote[],marketAsOf:number|null,marketError:boolean,commodityError:boolean):GalaxyQuote[] {
  const valid=(n:unknown):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>0;
  const btc=assets.find(a=>a.id==="bitcoin");
  const btcTime=Date.parse((btc as (TerminalAsset & {last_updated?:string})|undefined)?.last_updated??"");
  const rows:GalaxyQuote[]=[{id:"bitcoin",name:"BTC",price:valid(btc?.current_price)?btc.current_price:null,unit:"USD / BTC",source:"CoinGecko",asOf:Number.isFinite(btcTime)?btcTime:marketAsOf,timeLabel:Number.isFinite(btcTime)?"As of":"Fetched",stale:marketError}];
  for(const [id,name,unit] of [["gold","មាស · Gold futures","USD / troy oz"],["wti","ប្រេង · WTI futures","USD / barrel"],["silver","ប្រាក់ · Silver futures","USD / troy oz"]]) {
    const q=commodities.find(item=>item.id===id);
    rows.push({id,name,unit,price:valid(q?.price)?q.price:null,source:"Yahoo Finance",asOf:valid(q?.asOf)?q.asOf:null,timeLabel:"As of",stale:commodityError});
  }
  return rows;
}
