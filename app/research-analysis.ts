export type ResearchPoint = { time: number; price: number };
export type ResearchEvidence = { name: string; weight: number; value: number; detail: string };
export type ResearchResult = { status: "ready" | "insufficient"; reason: string; up: number | null; down: number | null; points: ResearchPoint[]; evidence: ResearchEvidence[]; asOf: number | null };

/** An explicit historical evidence index, never a calibrated forecast or news sentiment model. */
export function analyzeResearch(points: ResearchPoint[], now: number, maxAgeMs: number, breadth?: { advancing: number; declining: number }) : ResearchResult {
  const empty = (reason: string): ResearchResult => ({ status:"insufficient", reason, up:null, down:null, points:[], evidence:[], asOf:null });
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return empty("Invalid analysis time.");
  if (!Array.isArray(points) || points.length < 12 || points.some((p,i) => !p || !Number.isFinite(p.time) || p.time > now || !Number.isFinite(p.price) || p.price <= 0 || (i > 0 && p.time <= points[i-1].time))) return empty("At least 12 valid, ordered historical observations are required. Future observations are rejected.");
  const values = points.slice(-400);
  const last = values.at(-1)!;
  if (now-last.time > maxAgeMs) return empty("The latest observation is too old for this analysis. Refresh the source.");
  const avg = (n:number) => values.slice(-n).reduce((sum,p)=>sum+p.price,0)/Math.min(n,values.length);
  const trend = (avg(5)/avg(Math.min(20,values.length))-1)*100;
  const momentum = (last.price/values.at(-6)!.price-1)*100;
  const clamp = (n:number) => Math.max(-1,Math.min(1,n));
  const evidence: ResearchEvidence[] = [
    { name:"Moving-average trend", weight:50, value:clamp(trend/2), detail:`5-observation mean vs up to 20 observations: ${trend.toFixed(2)}%. Scaled by 2%.` },
    { name:"Observed momentum", weight:30, value:clamp(momentum/5), detail:`Last 5 observation intervals: ${momentum.toFixed(2)}%. Scaled by 5%.` },
  ];
  if (breadth && [breadth.advancing,breadth.declining].every(n=>Number.isInteger(n)&&n>=0) && breadth.advancing+breadth.declining>0) {
    evidence.push({name:"Tracked crypto breadth",weight:20,value:(breadth.advancing-breadth.declining)/(breadth.advancing+breadth.declining),detail:`${breadth.advancing} advancing / ${breadth.declining} declining; unchanged/missing excluded. Applies only to the tracked crypto sample.`});
  }
  const total=evidence.reduce((n,e)=>n+e.weight,0);
  const score=evidence.reduce((n,e)=>n+e.value*e.weight,0)/total;
  const up=Math.round(50+score*50);
  return {status:"ready",reason:"Historical evidence index. Heuristic weights; no empirical probability calibration or news-causality inference.",up,down:100-up,points:values,evidence,asOf:last.time};
}
