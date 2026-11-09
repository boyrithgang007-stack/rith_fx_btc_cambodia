import {randomUUID} from "node:crypto";
import {getCurrentUser,allowAuthAttempt} from "../../lib/auth";
import {isSameOriginRequest,readLimitedJson} from "../../lib/auth-http";
import {CANDLE_MARKETS,CANDLE_FRAMES,type CandleMarket,type CandleFrame} from "../../candle-markets";
import {loadCandleFeed,CandleFeedError} from "../../lib/candle-feed";
import {closedCandleSignal} from "../../lib/candle-signal";
import {marketPressure} from "../../lib/market-pressure";
import {candleAiConfigured,reviewCandleEvidence} from "../../lib/candle-review";
import {visionConfigured} from "../../lib/image-analysis";
import {listCandleAnalysisReports,saveCandleAnalysisReport} from "../../lib/candle-analysis-store";
import {telegramSignalPublisherStatus} from "../../lib/telegram-signal-worker";
import type {AiCandleReview,CandleAnalysisReport} from "../../candle-types";
export const runtime="nodejs";
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(){
  const user=await getCurrentUser();if(!user)return json({error:"Sign in with an approved account."},401);
  return json({aiConfigured:candleAiConfigured(),visionConfigured:visionConfigured(),forexConfigured:Boolean(process.env.TWELVEDATA_API_KEY?.trim()),telegramSignalStatus:telegramSignalPublisherStatus(),cryptoProvider:"Binance public market data",mode:"paper-research",reports:await listCandleAnalysisReports(user.id)});
}
export async function POST(request:Request){
  if(!isSameOriginRequest(request))return json({error:"Cross-origin requests are not allowed."},403);
  const user=await getCurrentUser();if(!user)return json({error:"Sign in with an approved account."},401);
  if(!allowAuthAttempt(`candle-analysis:${user.id}`,6,60000))return json({error:"Please wait before generating another report."},429);
  const body=await readLimitedJson(request,2048);
  if(!body||typeof body.market!=="string"||!Object.hasOwn(CANDLE_MARKETS,body.market)||typeof body.frame!=="string"||!Object.hasOwn(CANDLE_FRAMES,body.frame)||typeof body.includeAi!=="boolean")return json({error:"Choose a supported market, timeframe and review mode."},400);
  if(body.rewardRatio!==undefined&&body.rewardRatio!==2&&body.rewardRatio!==3)return json({error:"Choose Risk:Reward 1:2 or 1:3."},400);
  const rewardRatio:2|3=body.rewardRatio===3?3:2;
  if(body.includeAi&&!candleAiConfigured())return json({error:"សេវាវិភាគសញ្ញាមិនទាន់អាចប្រើបានទេ។ សូមសាកល្បងម្ដងទៀតនៅពេលក្រោយ។"},503);
  const market=body.market as CandleMarket,frame=body.frame as CandleFrame;
  try {
    const feed=await loadCandleFeed(market,frame,Date.now());
    const checked=closedCandleSignal(feed.candles,CANDLE_FRAMES[frame].ms,Date.now(),rewardRatio);
    let signal={action:checked.signal.action,reason:checked.signal.reason,entry:checked.signal.entry,stopLoss:checked.signal.stopLoss,takeProfit:checked.signal.takeProfit,checks:checked.signal.checks};
    let ai:AiCandleReview={status:"not_requested",consistent:null,summary:"Technical rules only. No additional review requested.",risks:[],observations:[]};
    if(body.includeAi&&checked.analysis&&checked.expiresAt)ai=await reviewCandleEvidence({symbol:CANDLE_MARKETS[market].symbol,frame,source:feed.source,asOf:feed.candles.at(-1)!.time,expiresAt:checked.expiresAt,signal,trend:checked.analysis.trend,candles:feed.candles.slice(-60)});
    else if(body.includeAi)ai={status:"unavailable",consistent:null,summary:"ការត្រួតពិនិត្យមិនបានដំណើរការ ព្រោះទិន្នន័យ candle មិនទាន់ថ្មី ឬគុណភាពមិនគ្រប់។ សូមធ្វើបច្ចុប្បន្នភាពប្រភពទិន្នន័យ។",risks:[],observations:[]};
    const generatedAt=Date.now();
    if(body.includeAi&&(ai.status!=="reviewed"||ai.consistent!==true))signal={...signal,action:"WAIT",entry:null,stopLoss:null,takeProfit:null,reason:checked.analysis?"The review could not confirm the setup. No entry signal.":checked.signal.reason};
    if(checked.expiresAt&&generatedAt>=checked.expiresAt)signal={...signal,action:"WAIT",entry:null,stopLoss:null,takeProfit:null,reason:"A new candle is due or data is stale. Generate a new report."};
    const report:CandleAnalysisReport={id:randomUUID(),market,frame,source:feed.source,rewardRatio,generatedAt,asOf:feed.candles.at(-1)?.time??null,expiresAt:checked.expiresAt,candles:feed.candles.slice(-100),trend:checked.analysis?.trend??"UNAVAILABLE",ema:checked.analysis?.ema.slice(-100)??[],signal,ai,volumeAvailable:feed.volumeAvailable,pressure:marketPressure(feed.candles)};
    await saveCandleAnalysisReport(user.id,report);
    return json(report);
  }catch(error){return json({error:error instanceof CandleFeedError?error.message:"Unable to fetch or validate candle data. No signal generated."},error instanceof CandleFeedError?error.status:502);}
}
