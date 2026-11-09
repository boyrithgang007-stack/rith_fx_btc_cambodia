import { getCurrentUser, allowAuthAttempt } from "@/app/lib/auth";
import { isSameOriginRequest, readLimitedJson } from "@/app/lib/auth-http";
import { answerMacroQuestion, macroAiConfigured, type MacroQuestionContext } from "@/app/lib/macro-ai";
import { parseCpiCalendar, parseForexFactoryCalendar, type MacroData, type SocialPost } from "@/app/lib/macro";
import {loadMacroEvidence} from "@/app/lib/macro-evidence";
export const runtime="nodejs";
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(){
  const user=await getCurrentUser();
  if(!user)return json({error:'Sign in with an approved account.'},401);
  if(!allowAuthAttempt(`macro:${user.id}`,20,60000))return json({error:'Please wait before refreshing.'},429);
  const [calendar,social,factory]=await Promise.allSettled([
    (async()=>{const r=await fetch('https://www.bls.gov/schedule/news_release/bls.ics',{next:{revalidate:3600},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const events=parseCpiCalendar(await r.text());if(!events.length)throw Error();return events;})(),
    (async()=>{
      if(!process.env.X_BEARER_TOKEN?.trim())return null;
      const url=new URL('https://api.x.com/2/tweets/search/recent');url.searchParams.set('query','(CPI OR inflation) (forex OR bitcoin OR USD) -is:retweet lang:en');url.searchParams.set('max_results','10');url.searchParams.set('tweet.fields','created_at');
      const r=await fetch(url,{headers:{Authorization:`Bearer ${process.env.X_BEARER_TOKEN.trim()}`},next:{revalidate:300},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();
      const body=await r.json();if(body.errors)throw Error();if(body.data!==undefined&&!Array.isArray(body.data))throw Error();
      return (body.data??[]).filter((p:{id?:unknown;text?:unknown;created_at?:unknown})=>typeof p.id==='string'&&/^\d+$/.test(p.id)&&typeof p.text==='string'&&typeof p.created_at==='string').map((p:{id:string;text:string;created_at:string}):SocialPost=>({id:p.id,text:p.text,time:p.created_at,url:`https://x.com/i/web/status/${p.id}`}));
    })(),
    (async()=>{
      const response=await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json',{next:{revalidate:300},signal:AbortSignal.timeout(12000),redirect:'error'});
      if(!response.ok)throw Error('Forex Factory unavailable');
      return parseForexFactoryCalendar(await response.json());
    })()
  ]);
  const data:MacroData={events:calendar.status==='fulfilled'?calendar.value:[],calendarStatus:calendar.status==='fulfilled'?'BLS calendar connected':'Calendar unavailable — check BLS directly',posts:social.status==='fulfilled'?(social.value??[]):[],socialStatus:social.status==='rejected'?'X unavailable — check API access / quota':social.value===null?'X not connected — paste a post below':'X connected · recent 7-day sample',checkedAt:Date.now()};
  data.forexFactory={events:factory.status==='fulfilled'?factory.value:[],status:factory.status==='fulfilled'?'connected':'unavailable',checkedAt:Date.now(),source:'Forex Factory · weekly export',sourceUrl:'https://www.forexfactory.com/calendar',feedUrl:'https://nfs.faireconomy.media/ff_calendar_thisweek.json'};
  return json({...data,aiConfigured:macroAiConfigured()});
}

function validContext(value:unknown):value is MacroQuestionContext {
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const context=value as Record<string,unknown>;
  const validTime=(time:unknown)=>time===null||(typeof time==="number"&&Number.isFinite(time)&&time>=0);
  const validText=(text:unknown,max:number)=>typeof text==="string"&&text.length<=max;
  const validCalendar=context.calendar===null||(
    !!context.calendar&&typeof context.calendar==="object"&&!Array.isArray(context.calendar)
    &&validText((context.calendar as Record<string,unknown>).title,200)
    &&typeof (context.calendar as Record<string,unknown>).time==="number"
    &&Number.isFinite((context.calendar as Record<string,unknown>).time)
  );
  const validScenario=context.scenario===null||(
    !!context.scenario&&typeof context.scenario==="object"&&!Array.isArray(context.scenario)
    &&validText((context.scenario as Record<string,unknown>).measure,80)
    &&["actual","forecast","surprise"].every(key=>typeof (context.scenario as Record<string,unknown>)[key]==="number"&&Number.isFinite((context.scenario as Record<string,unknown>)[key]))
    &&validText((context.scenario as Record<string,unknown>).label,40)
  );
  return validCalendar&&validScenario&&Array.isArray(context.quotes)&&context.quotes.length<=20
    &&context.quotes.every(quote=>!!quote&&typeof quote==="object"&&!Array.isArray(quote)
      &&typeof (quote as Record<string,unknown>).symbol==="string"&&/^[A-Za-z0-9._-]{1,20}$/.test((quote as Record<string,unknown>).symbol as string)
      &&typeof (quote as Record<string,unknown>).price==="number"&&Number.isFinite((quote as Record<string,unknown>).price as number)&&(quote as Record<string,unknown>).price as number>=0)
    &&validTime(context.pricesAsOf)&&validText(context.calendarStatus,120)&&validText(context.socialStatus,120)
    &&Number.isInteger(context.socialPostCount)&&Number(context.socialPostCount)>=0&&Number(context.socialPostCount)<=100;
}

export async function POST(request:Request){
  if(!isSameOriginRequest(request))return json({error:"Cross-origin requests are not allowed."},403);
  const user=await getCurrentUser();if(!user)return json({error:"Sign in with an approved account."},401);
  if(!allowAuthAttempt(`macro-ai:${user.id}`,6,60000))return json({error:"Please wait before asking another question."},429);
  const body=await readLimitedJson(request,8192);
  if(!body||typeof body.question!=="string"||!body.question.trim()||body.question.length>500
    ||(body.language!=="km"&&body.language!=="en")||!validContext(body.context)){
    return json({error:"Enter a question up to 500 characters and refresh the CPI context."},400);
  }
  if(!macroAiConfigured())return json({error:"មុខងារជំនួយការទីផ្សារមិនទាន់អាចប្រើបានទេ។ សូមសាកល្បងម្ដងទៀតនៅពេលក្រោយ។"},503);
  try{
    const evidence=await loadMacroEvidence();
    const answer=await answerMacroQuestion({question:body.question.trim(),language:body.language,context:body.context,evidence});
    return json({answer,sources:evidence.sources,checkedAt:evidence.checkedAt});
  }catch{
    return json({error:"មិនអាចបង្កើតចម្លើយបានទេ។ សូមសាកល្បងម្ដងទៀត។"},502);
  }
}
