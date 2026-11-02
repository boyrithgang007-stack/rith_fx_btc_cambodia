import { BLOOMBERG_FEED,parseBloombergHeadlines } from "@/app/lib/bloomberg";
export async function GET(){
  try{
    const response=await fetch(BLOOMBERG_FEED,{next:{revalidate:600},redirect:"error",signal:AbortSignal.timeout(12000)});
    if(!response.ok||Number(response.headers.get("content-length"))>2_000_000)throw Error();
    const headlines=parseBloombergHeadlines(await response.text());
    return Response.json({source:"Bloomberg Economics",headlines,checkedAt:Date.now()},{headers:{"Cache-Control":"public, max-age=60, s-maxage=600"}});
  }catch{return Response.json({error:"Bloomberg headlines are temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
