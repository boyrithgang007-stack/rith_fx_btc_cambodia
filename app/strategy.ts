export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type Direction = "BUY" | "SELL";
export type Structure = { index: number; pivotIndex: number; price: number; direction: Direction; kind: "BOS" | "CHoCH" | "BREAK" };
export type Zone = { id: string; direction: Direction; index: number; obIndex: number; top: number; bottom: number; obTop: number; obBottom: number; touchedAt: number | null; invalidatedAt: number | null };
export type Analysis = { trend: "BULLISH" | "BEARISH" | "RANGE"; events: Structure[]; zones: Zone[]; ema: number[]; atr: number; support: number | null; resistance: number | null };
export type Signal = { action: Direction | "WAIT"; reason: string; zone: Zone | null; entry: number | null; stopLoss: number | null; takeProfit: number | null; quantity: number; riskAmount: number; notional: number; checks: { label: string; passed: boolean }[] };

export function validCandles(value: unknown): value is Candle[] {
  return Array.isArray(value) && value.every((c, i) => c && [c.time,c.open,c.high,c.low,c.close].every(Number.isFinite) && c.time > 0 && c.low > 0 && c.high >= Math.max(c.open,c.close) && c.low <= Math.min(c.open,c.close) && (i === 0 || c.time > value[i-1].time));
}

// All timestamps are candle CLOSE times. A pivot is available only after its right-hand window closes.
export function analyzeMarket(candles: Candle[], pivot = 2): Analysis {
  const events: Structure[] = [], zones: Zone[] = [], ema: number[] = [];
  let high: { index: number; price: number } | null = null, low: { index: number; price: number } | null = null;
  let direction: Direction | null = null;
  const ranges: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    ema.push(i ? c.close * (2/21) + ema[i-1] * (19/21) : c.close);
    ranges.push(Math.max(c.high-c.low, i ? Math.abs(c.high-candles[i-1].close) : 0, i ? Math.abs(c.low-candles[i-1].close) : 0));
    const p = i-pivot;
    if (p >= pivot) {
      const neighbors = candles.slice(p-pivot,i+1).filter((_, j) => j !== pivot);
      if (neighbors.every(n => n.high < candles[p].high)) high = {index:p,price:candles[p].high};
      if (neighbors.every(n => n.low > candles[p].low)) low = {index:p,price:candles[p].low};
    }
    const breakDirection = high && c.close > high.price ? "BUY" : low && c.close < low.price ? "SELL" : null;
    if (breakDirection) {
      const broken = breakDirection === "BUY" ? high! : low!;
      events.push({ index:i, pivotIndex:broken.index, price:broken.price, direction:breakDirection, kind:direction === null ? "BREAK" : direction === breakDirection ? "BOS" : "CHoCH" });
      direction = breakDirection;
      if (breakDirection === "BUY") high = null; else low = null;
    }
    for (const z of zones) {
      if (z.invalidatedAt !== null) continue;
      if (z.touchedAt === null && c.low <= z.top && c.high >= z.bottom) z.touchedAt = i;
      if (z.direction === "BUY" ? c.low < z.obBottom : c.high > z.obTop) z.invalidatedAt = i;
    }
    if (i < 2) continue;
    const first = candles[i-2];
    const side: Direction | null = c.low > first.high ? "BUY" : c.high < first.low ? "SELL" : null;
    const event = events.at(-1);
    if (!side || !event || event.direction !== side || i-event.index > 3) continue;
    // Only the opposite candle within the recent impulse can become the paired OB.
    let ob = i-1;
    for (; ob >= Math.max(0,i-8); ob--) {
      if (side === "BUY" ? candles[ob].close < candles[ob].open : candles[ob].close > candles[ob].open) break;
    }
    if (ob < Math.max(0,i-8)) continue;
    const bottom = side === "BUY" ? first.high : c.high, top = side === "BUY" ? c.low : first.low;
    zones.push({ id:`${c.time}:${side}`, direction:side, index:i, obIndex:ob, bottom, top, obBottom:candles[ob].low, obTop:candles[ob].high, touchedAt:null, invalidatedAt:null });
  }
  const last = candles.at(-1);
  const trend = last && candles.length >= 20 && direction === "BUY" && last.close > ema.at(-1)! ? "BULLISH" : last && candles.length >= 20 && direction === "SELL" && last.close < ema.at(-1)! ? "BEARISH" : "RANGE";
  return { trend, events, zones, ema, atr:ranges.slice(-14).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(14,ranges.length)), support:low?.price ?? null, resistance:high?.price ?? null };
}

export function evaluateSignal(candles: Candle[], capital = 10000, riskPercent = 1, rr = 2, analysis = analyzeMarket(candles)): Signal {
  const riskAmount = Number.isFinite(capital) && capital > 0 ? capital * Math.min(2,Math.max(0.1,Number.isFinite(riskPercent) ? riskPercent : 1))/100 : 0;
  const empty: Signal = {action:"WAIT",reason:"ទិន្នន័យមិនគ្រប់គ្រាន់ (ត្រូវការ 20 candles)។",zone:null,entry:null,stopLoss:null,takeProfit:null,quantity:0,riskAmount,notional:0,checks:[]};
  if (candles.length < 20 || !validCandles(candles)) return empty;
  const index = candles.length-1, c = candles[index];
  const side = analysis.trend === "BULLISH" ? "BUY" : analysis.trend === "BEARISH" ? "SELL" : null;
  const zone = [...analysis.zones].reverse().find(z => z.direction === side && z.invalidatedAt === null && index-z.index <= 40 && (z.touchedAt === null || z.touchedAt === index)) ?? null;
  const touched = !!zone && zone.touchedAt === index;
  const rejection = !!zone && touched && (side === "BUY" ? c.close > zone.top && c.close > c.open : c.close < zone.bottom && c.close < c.open);
  const checks = [{label:"ទិសដៅ Structure + EMA 20",passed:side !== null},{label:"FVG + OB នៅសុពលភាព",passed:!!zone},{label:"ប៉ះ FVG លើកដំបូង",passed:touched},{label:"Candle បិទបញ្ជាក់ rejection",passed:rejection}];
  if (!zone) return {...empty,checks,reason:side ? "រង់ចាំ FVG + OB ថ្មីដែលស្របទិសដៅ។" : "ទិសដៅមិនច្បាស់ — រង់ចាំ structure និង EMA ស្របគ្នា។"};
  const entry = c.close;
  const stopLoss = side === "BUY" ? Math.min(zone.obBottom,zone.bottom)-analysis.atr*0.2 : Math.max(zone.obTop,zone.top)+analysis.atr*0.2;
  const distance = Math.abs(entry-stopLoss);
  if (distance <= 0 || stopLoss <= 0 || riskAmount <= 0) return {...empty,checks,reason:"កម្រិតហានិភ័យមិនត្រឹមត្រូវ។"};
  const takeProfit = entry + (side === "BUY" ? 1 : -1)*distance*Math.min(5,Math.max(1,Number.isFinite(rr) ? rr : 2));
  if (takeProfit <= 0) return {...empty,checks,reason:"គោលដៅតម្លៃមិនត្រឹមត្រូវ។"};
  // Unleveraged paper sizing; cap exposure to configured capital.
  const quantity = Math.min(riskAmount/distance,capital/entry);
  return {action:rejection ? side! : "WAIT",reason:rejection ? "First touch + rejection បានបញ្ជាក់នៅ candle បិទចុងក្រោយ។ ពិនិត្យតម្លៃថ្មីមុនចូល។" : "រង់ចាំ first touch និង candle បិទត្រឡប់ចេញពី FVG។",zone,entry:rejection ? entry : null,stopLoss,takeProfit:rejection ? takeProfit : null,quantity:rejection ? quantity : 0,riskAmount:rejection ? quantity*distance : riskAmount,notional:rejection ? quantity*entry : 0,checks};
}

export type PaperTrade = { time:number; direction:Direction; entry:number; exit:number; pnl:number; reason:string };
export function backtestStrategy(candles: Candle[], capital:number, risk:number, rr:number, costBps=10, confirmation?: Confirmation) {
  costBps=Number.isFinite(costBps) ? Math.min(100,Math.max(0,costBps)) : 10;
  risk=Number.isFinite(risk) ? Math.min(2,Math.max(.1,risk)) : 1;
  rr=Number.isFinite(rr) ? Math.min(5,Math.max(1,rr)) : 2;
  capital=Number.isFinite(capital) && capital>0 ? capital : 10000;
  if(!validCandles(candles)) candles=[];
  let balance=capital,peak=capital,maxDrawdown=0;
  const trades:PaperTrade[]=[];
  for(let i=19;i<candles.length-1;i++) {
    const signal=evaluateConfirmedSignal(candles.slice(0,i+1),balance,risk,rr,confirmation,costBps);
    if(signal.action === "WAIT" || signal.stopLoss === null) continue;
    const sign=signal.action === "BUY" ? 1 : -1;
    const entry=candles[i+1].open,sl=signal.stopLoss;
    const distance=(entry-sl)*sign;
    if(distance<=0) continue;
    const tp=entry+sign*distance*Math.min(5,Math.max(1,rr));
    if(tp<=0) continue;
    const rate=costBps/10000;
    const qty=Math.min(balance*risk/100/(distance+(entry+sl)*rate),balance/(entry*(1+rate)));
    let exit=candles.at(-1)!.close,exitIndex=candles.length-1,reason="END";
    for(let j=i+1;j<candles.length;j++) {
      const c=candles[j];
      if((c.open-sl)*sign<=0) {exit=c.open;exitIndex=j;reason="SL gap";break;}
      if((c.open-tp)*sign>=0) {exit=tp;exitIndex=j;reason="TP";break;}
      if(sign===1 ? c.low<=sl : c.high>=sl) {exit=sl;exitIndex=j;reason="SL";break;}
      if(sign===1 ? c.high>=tp : c.low<=tp) {exit=tp;exitIndex=j;reason="TP";break;}
    }
    const pnl=qty*((exit-entry)*sign-(entry+exit)*Math.max(0,costBps)/10000);
    balance+=pnl;peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,(peak-balance)/peak*100);
    trades.push({time:candles[i+1].time,direction:signal.action,entry,exit,pnl,reason});
    i=exitIndex;
    if(balance<=0) break;
  }
  const wins=trades.filter(t=>t.pnl>0).length;
  const grossProfit=trades.reduce((sum,t)=>sum+Math.max(0,t.pnl),0),grossLoss=trades.reduce((sum,t)=>sum+Math.max(0,-t.pnl),0);
  let running=capital;
  const equityCurve=[capital,...trades.map(t=>(running+=t.pnl))];
  return {equityCurve,profitFactor:grossLoss ? grossProfit/grossLoss : null,expectancy:trades.length ? (balance-capital)/trades.length : 0,trades,wins,winRate:trades.length ? wins/trades.length*100 : 0,netReturn:capital>0 ? (balance-capital)/capital*100 : 0,maxDrawdown};
}

export type Confirmation = { candles: Candle[]; intervalMs: number; requireDiscount?: boolean; baseIntervalMs?: number };

/** UTC-aligned complete groups only; never expose a partial higher-timeframe candle. */
export function aggregateCandles(candles: Candle[], baseMs: number, targetMs: number): Candle[] {
  if (!validCandles(candles) || baseMs <= 0 || targetMs <= baseMs || targetMs % baseMs !== 0) return [];
  const groups = new Map<number, Candle[]>();
  for (const candle of candles) {
    const end = Math.ceil(candle.time / targetMs) * targetMs;
    groups.set(end, [...(groups.get(end) ?? []), candle]);
  }
  const result: Candle[] = [];
  for (const [end, group] of groups) {
    if (group.length !== targetMs / baseMs || group[0].time !== end-targetMs+baseMs || group.at(-1)!.time !== end || group.some((c,i)=>i>0 && c.time-group[i-1].time!==baseMs)) continue;
    result.push({time:end,open:group[0].open,close:group.at(-1)!.close,high:Math.max(...group.map(c=>c.high)),low:Math.min(...group.map(c=>c.low)),volume:group.reduce((sum,c)=>sum+(Number.isFinite(c.volume) ? c.volume : 0),0)});
  }
  return result;
}

export function hasContinuousCandles(candles: Candle[], intervalMs: number) {
  return validCandles(candles) && Number.isFinite(intervalMs) && intervalMs > 0 && candles.every((c,i)=>i===0 || c.time-candles[i-1].time===intervalMs);
}

export function evaluateConfirmedSignal(candles: Candle[], capital: number, risk: number, rr: number, confirmation?: Confirmation, costBps=0): Signal {
  const base = evaluateSignal(candles,capital,risk,rr);
  let result = base;
  if (confirmation) {
    const at = candles.at(-1)?.time ?? 0;
    const higher = confirmation.candles.filter(c=>c.time<=at);
    const ready = higher.length>=20 && hasContinuousCandles(higher,confirmation.intervalMs) && at-higher.at(-1)!.time<confirmation.intervalMs;
    const trend = ready ? analyzeMarket(higher).trend : "RANGE";
    const lowerTrend = analyzeMarket(candles).trend;
    const aligned = ready && trend!=="RANGE" && trend===lowerTrend;
    const range = higher.slice(-20);
    const midpoint = range.length ? (Math.max(...range.map(c=>c.high))+Math.min(...range.map(c=>c.low)))/2 : 0;
    const zoneMid = base.zone ? (base.zone.top+base.zone.bottom)/2 : null;
    const discount = zoneMid!==null && (lowerTrend==="BULLISH" ? zoneMid<midpoint : lowerTrend==="BEARISH" && zoneMid>midpoint);
    const continuous = !confirmation.baseIntervalMs || hasContinuousCandles(candles,confirmation.baseIntervalMs);
    const checks=[...base.checks,{label:"ទិន្នន័យ LTF / HTF ពេញលេញ",passed:ready && continuous},{label:"ទិសដៅ HTF ស្របគ្នា",passed:aligned},...(confirmation.requireDiscount ? [{label:"FVG នៅ Discount / Premium (HTF 20 bars)",passed:discount}] : [])];
    if(!ready || !continuous || !aligned || (confirmation.requireDiscount && !discount)) {
      result={...base,action:"WAIT",entry:null,takeProfit:null,quantity:0,notional:0,checks,reason:!ready || !continuous ? "រង់ចាំទិន្នន័យ LTF / HTF ពេញលេញ និងថ្មី។" : !aligned ? "ទិសដៅ timeframe ធំមិនទាន់ស្របគ្នា — រង់ចាំ។" : "FVG មិនស្ថិតនៅ Discount / Premium តាម HTF 20 candles។"};
    } else result={...base,checks};
  }
  if(result.action!=="WAIT" && result.entry!==null && result.stopLoss!==null){
    const rate=Math.min(100,Math.max(0,Number.isFinite(costBps) ? costBps : 0))/10000;
    const distance=Math.abs(result.entry-result.stopLoss);
    const budget=capital*Math.min(2,Math.max(.1,risk))/100;
    const quantity=Math.min(budget/(distance+(result.entry+result.stopLoss)*rate),capital/(result.entry*(1+rate)));
    result={...result,quantity,notional:quantity*result.entry,riskAmount:quantity*(distance+(result.entry+result.stopLoss)*rate)};
  }
  return result;
}

export type ChartSignal = { index:number; time:number; signal:Signal };
/** Re-evaluate each closed prefix with the same filters; future bars never label past signals. */
export function chartSignals(candles:Candle[],capital:number,risk:number,rr:number,confirmation?:Confirmation,costBps=0):ChartSignal[] {
  if(!validCandles(candles))return [];
  const markers:ChartSignal[]=[];
  for(let index=19;index<candles.length;index++){
    const signal=evaluateConfirmedSignal(candles.slice(0,index+1),capital,risk,rr,confirmation,costBps);
    if(signal.action!=="WAIT")markers.push({index,time:candles[index].time,signal});
  }
  return markers;
}
