import {parseCpiCalendar,parseForexFactoryCalendar} from "./macro";
export type MacroEvidenceSource={name:string;url:string;status:"available"|"unavailable";checkedAt:number};
export async function loadMacroEvidence(fetcher:typeof fetch=fetch,now=Date.now()){
  const definitions=[
    {name:"BLS CPI calendar",url:"https://www.bls.gov/schedule/news_release/bls.ics"},
    {name:"Forex Factory weekly calendar",url:"https://nfs.faireconomy.media/ff_calendar_thisweek.json"},
    {name:"CoinGecko reference prices",url:"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true"},
  ];
  const results=await Promise.allSettled(definitions.map(async(source,index)=>{
    const key=process.env.COINGECKO_API_KEY?.trim();
    const r=await fetcher(source.url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000),...(index===2&&key?{headers:{"x-cg-demo-api-key":key}}:{})});
    if(!r.ok)throw Error("Source unavailable");
    if(index===0){const events=parseCpiCalendar(await r.text());if(!events.length)throw Error();return events.filter(e=>e.time>=now).slice(0,5);}
    if(index===1)return parseForexFactoryCalendar(await r.json()).filter(e=>e.isCpi||/non.?farm|payroll|\bppi\b|\bpce\b/i.test(e.title)).slice(0,40);
    const data=await r.json();
    const quotes=["bitcoin","ethereum"].flatMap(id=>{const q=data?.[id],at=Number(q?.last_updated_at)*1000;return typeof q?.usd==="number"&&Number.isFinite(q.usd)&&q.usd>0&&Number.isFinite(at)&&at<=now&&now-at<=300000?[{symbol:id==="bitcoin"?"BTC":"ETH",price:q.usd,asOf:at}]:[];});
    if(!quotes.length)throw Error("Stale prices");return quotes;
  }));
  return {checkedAt:now,sources:definitions.map((source,i):MacroEvidenceSource=>({...source,status:results[i].status==="fulfilled"?"available":"unavailable",checkedAt:now})),calendar:results[0].status==="fulfilled"?results[0].value:[],events:results[1].status==="fulfilled"?results[1].value:[],quotes:results[2].status==="fulfilled"?results[2].value:[]};
}
