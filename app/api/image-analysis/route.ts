import {randomUUID} from "node:crypto";
import {getCurrentUser,allowAuthAttempt} from "../../lib/auth";
import {isSameOriginRequest,readLimitedJson} from "../../lib/auth-http";
import {analyzeDataImage,validateAnalysisImage,ImageAnalysisError,visionConfigured} from "../../lib/image-analysis";
export const runtime="nodejs";
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
  if(!isSameOriginRequest(request))return json({error:"Cross-origin requests are not allowed."},403);
  const user=await getCurrentUser();if(!user)return json({error:"Sign in with an approved account."},401);
  if(!allowAuthAttempt(`image-analysis:${user.id}`,4,60000))return json({error:"Please wait before uploading another image."},429);
  if(!visionConfigured())return json({error:"មុខងារអានរូបមិនទាន់អាចប្រើបានទេ។ សូមសាកល្បងម្ដងទៀតនៅពេលក្រោយ។"},503);
  const body=await readLimitedJson(request,6*1024*1024);
  if(!body||typeof body.question!=="string"||body.question.length>500)return json({error:"Image request is too large or the question is invalid (maximum 500 characters)."},400);
  try{
    const image=await validateAnalysisImage(body.image);
    const evidence=await analyzeDataImage(image.dataUrl,body.question.trim());
    return json({id:randomUUID(),createdAt:Date.now(),width:image.width,height:image.height,evidence,tradeAction:"WAIT",basis:"image-only"});
  }catch(error){return json({error:error instanceof ImageAnalysisError?error.message:"Unable to read this image."},error instanceof ImageAnalysisError?error.status:502);}
}
