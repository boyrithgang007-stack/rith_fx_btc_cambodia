export type MacroEvent = { title:string; time:number };
export type SocialPost = {id:string;text:string;time:string;url:string};
export type ForexFactoryEvent = { id:string; title:string; currency:string; time:number; impact:"High"|"Medium"|"Low"|"Holiday"; forecast:string|null; previous:string|null; actual:string|null; isCpi:boolean };
export type ForexFactorySnapshot = { events:ForexFactoryEvent[]; status:"connected"|"unavailable"; checkedAt:number; source:string; sourceUrl:string; feedUrl:string };
export type MacroData = {events:MacroEvent[];calendarStatus:string;socialStatus:string;posts:SocialPost[];checkedAt:number;forexFactory?:ForexFactorySnapshot};
export function parseForexFactoryCalendar(payload:unknown):ForexFactoryEvent[] {
  if(!Array.isArray(payload)||payload.length>5000)throw new Error("Invalid Forex Factory feed");
  const value=(field:unknown):string|null=> typeof field==="string" && field.trim() && field.length<=64 ? field.trim() : typeof field==="number"&&Number.isFinite(field)?String(field):null;
  const events:ForexFactoryEvent[]=[];
  for(const row of payload){
    if(!row||typeof row!=="object"||typeof row.title!=="string"||!row.title.trim()||row.title.length>200
      ||typeof row.country!=="string"||!/^[A-Z]{3}$/.test(row.country)||!['High','Medium','Low','Holiday'].includes(row.impact)
      ||typeof row.date!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(row.date))continue;
    const time=Date.parse(row.date);if(!Number.isFinite(time))continue;
    const title=row.title.trim();
    events.push({id:`${row.country}:${time}:${title}`,title,currency:row.country,time,impact:row.impact,
      forecast:value(row.forecast),previous:value(row.previous),actual:value(row.actual),isCpi:/\bcpi\b|consumer price index/i.test(title)});
  }
  if(payload.length&&!events.length)throw new Error("No valid Forex Factory events");
  return [...new Map(events.map(event=>[event.id,event])).values()].sort((a,b)=>a.time-b.time||a.title.localeCompare(b.title));
}
export function parseCpiCalendar(text:string):MacroEvent[] {
  const unfolded=text.replace(/\r?\n[ \t]/g,"");
  const events:MacroEvent[]=[];
  for(const chunk of unfolded.split("BEGIN:VEVENT").slice(1)){
    const title=chunk.match(/(?:^|\n)SUMMARY:(.+)/)?.[1]?.trim();
    if(!title || !/consumer price index/i.test(title))continue;
    const match=chunk.match(/(?:^|\n)DTSTART(?:;TZID=([^:\r\n]+))?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
    if(!match)continue;
    const [,zone,yr,mo,day,hr,min,sec,zulu]=match;
    const wall=Date.UTC(+yr,+mo-1,+day,+hr,+min,+sec);
    let time=wall;
    if(!zulu){
      if(!zone || !['America/New_York','US/Eastern','US-Eastern','Eastern Standard Time'].includes(zone))continue;
      for(let i=0;i<3;i++){
        const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(time).map(p=>[p.type,p.value]));
        const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
        time+=wall-local;
      }
    }
    if(Number.isFinite(time))events.push({title:title.replace(/\\,/g,','),time});
  }
  return [...new Map(events.map(e=>[e.time,e])).values()].sort((a,b)=>a.time-b.time);
}
export function compareCpi(actual:string,forecast:string) {
  if(!actual.trim() || !forecast.trim())return null;
  const a=Number(actual),f=Number(forecast);
  if(!Number.isFinite(a)||!Number.isFinite(f)||Math.abs(a)>100||Math.abs(f)>100)return null;
  const surprise=Number((a-f).toFixed(3));
  return {surprise,label:surprise>0?'Above forecast':surprise<0?'Below forecast':'In line',explanation:surprise>0?'A hotter reading can raise expectations of tighter policy. Watch USD and yields; crypto and FX responses are not guaranteed.':surprise<0?'A cooler reading can ease policy expectations. Watch USD and yields for confirmation; other news can dominate.':'No headline surprise. Core CPI, revisions and positioning may drive the reaction.'};
}
export function inspectPost(text:string) {
  const topics=[['CPI',/\bcpi\b|inflation|អតិផរណា/i],['USD / Forex',/\busd\b|forex|eur|jpy|dollar/i],['Crypto',/bitcoin|\bbtc\b|crypto|ethereum|\beth\b/i]].filter(([,rule])=>(rule as RegExp).test(text)).map(([label])=>String(label));
  return {topics,claims:(text.match(/[-+]?\d+(?:\.\d+)?\s*%/g)||[]).slice(0,8),warning:'Unverified text. Check publication time, original source, headline vs core and MoM vs YoY before comparing figures.'};
}
export function answerMacro(question:string, data:MacroData|null, now:number, scenario:ReturnType<typeof compareCpi>, quotes:{symbol:string;price:number}[], language:"km"|"en"="en") {
  const km=language==="km";
  const q=question.toLowerCase();
  if(/\b(buy|sell|long|short)\b|ទិញ|លក់/.test(q))return km
    ? 'CPI ឬប្រកាសបណ្ដាញសង្គមតែមួយមុខ មិនអាចបញ្ជាក់ BUY/SELL បានទេ។ ប្រៀបធៀបតម្លៃជាក់ស្តែងនឹងការព្យាករណ៍លើសូចនាករដូចគ្នា រួចពិនិត្យការបញ្ជាក់ពី candle ដែលបានបិទក្នុងក្រាបយុទ្ធសាស្ត្រ។ កាលវិភាគមិនផ្អាកសញ្ញាយុទ្ធសាស្ត្រដោយស្វ័យប្រវត្តិទេ។'
    : 'CPI or a social post alone cannot confirm BUY/SELL. Compare actual versus consensus on the same measure, then use the Strategy chart for closed-candle confirmation. The calendar does not automatically block strategy signals.';
  if(/when|time|schedule|next|ពេល|ម៉ោង|នៅពេលណា/.test(q)){
    const next=data?.events.find(e=>e.time>now);
    return next
      ? km ? `ការប្រកាស CPI តាមកាលវិភាគលើកក្រោយ៖ ${new Date(next.time).toLocaleString('km-KH',{timeZone:'Asia/Bangkok'})} (អាស៊ី/បាងកក)។ ប្រភព៖ ប្រតិទិន BLS។ សូមពិនិត្យទំព័រផ្លូវការសម្រាប់ការកែប្រែ។` : `Next scheduled CPI: ${new Date(next.time).toLocaleString('en-GB',{timeZone:'Asia/Bangkok'})} (Asia/Bangkok). Source: BLS calendar. Check the official page for changes.`
      : km ? 'មិនមានកាលបរិច្ឆេទប្រកាសខាងមុខដែលបានផ្ទៀងផ្ទាត់ទេ។ សូមបើកកាលវិភាគ BLS ផ្លូវការ; ប្រព័ន្ធមិនប៉ាន់ស្មានកាលបរិច្ឆេទឡើយ។' : 'No verified upcoming release is available. Open the BLS schedule; I will not guess the date.';
  }
  if(/price|quote|តម្លៃ/.test(q)){
    const match=quotes.find(p=>new RegExp(`\\b${p.symbol.toLowerCase()}\\b`).test(q));
    return match
      ? km ? `${match.symbol.toUpperCase()}: $${match.price.toLocaleString('en-US',{maximumFractionDigits:8})} USD ពីទិន្នន័យទីផ្សារដែលបានបង្ហាញ។ នេះមិនមែនជាតម្លៃ broker សម្រាប់បញ្ជាទិញទេ។` : `${match.symbol.toUpperCase()}: $${match.price.toLocaleString('en-US',{maximumFractionDigits:8})} USD from the displayed market snapshot. This is not an executable broker quote.`
      : km ? 'សូមប្រើនិមិត្តសញ្ញាកាក់ដែលមានក្នុងបញ្ជី ឧ. “តម្លៃ BTC ប៉ុន្មាន?”។ Forex ខាងក្រោមជាអត្រាយោងប្រចាំថ្ងៃ ECB មិនមែនតម្លៃ broker ផ្ទាល់ទេ។' : 'Use a listed crypto ticker, e.g. “BTC price”. Forex below uses daily ECB reference rates, not live broker quotes.';
  }
  if(/social|twitter|\bx\b|post|ព័ត៌មាន|បណ្ដាញសង្គម/.test(q))return data?.posts.length
    ? km ? `ប្រភពព័ត៌មានដែលភ្ជាប់បានផ្ដល់ប្រកាសពាក់ព័ន្ធនឹង CPI ចំនួន ${data.posts.length} ក្នុងរយៈពេល 7 ថ្ងៃចុងក្រោយ។ នេះជាគំរូតិចតួចដែលមិនទាន់ផ្ទៀងផ្ទាត់ មិនមែនជាមតិទីផ្សារទាំងមូលទេ។ សូមបើកប្រកាសដើមដើម្បីពិនិត្យបរិបទ។` : `The connected feed returned ${data.posts.length} recent CPI-related posts (last 7 days). These are a small, unverified sample, not a market-wide sentiment score. Open each original post to check context.`
    : km ? 'មិនមានប្រកាសបណ្ដាញសង្គមផ្ទាល់ទេ។ សូមបិទភ្ជាប់ប្រកាសក្នុងផ្នែកផ្ទៀងផ្ទាត់ប្រភព ឬកំណត់ការភ្ជាប់ X API។ ការខ្វះទិន្នន័យមិនមានន័យថាមតិទីផ្សារអព្យាក្រឹតទេ។' : 'No live social posts are available. Paste a post in Source check, or configure the X API connection. Missing data does not mean neutral sentiment.';
  if(/cpi|inflation|forex|crypto|usd|btc|អតិផរណា|ប៉ះពាល់/.test(q))return scenario
    ? km ? `សេណារីយ៉ូដែលអ្នកបញ្ចូលដោយដៃគឺ ${scenario.label==='Above forecast'?'លើសការព្យាករណ៍':scenario.label==='Below forecast'?'ក្រោមការព្យាករណ៍':'ស្របតាមការព្យាករណ៍'} ចំនួន ${scenario.surprise} ពិន្ទុភាគរយ។ ${scenario.surprise>0?'តម្លៃខ្ពស់ជាងអាចបង្កើនការរំពឹងទុកអំពីគោលនយោបាយតឹងរ៉ឹង។ សូមមើល USD និងអត្រាការប្រាក់; ប្រតិកម្មទីផ្សារមិនអាចធានាបានទេ។':scenario.surprise<0?'តម្លៃទាបជាងអាចបន្ថយការរំពឹងទុកអំពីគោលនយោបាយតឹងរ៉ឹង។ សូមរង់ចាំការបញ្ជាក់; ព័ត៌មានផ្សេងអាចមានឥទ្ធិពលខ្លាំងជាង។':'មិនមានការភ្ញាក់ផ្អើលលើតួលេខសំខាន់ទេ។ CPI ស្នូល និងការកែតម្រូវទិន្នន័យអាចជំរុញទីផ្សារ។'} តម្លៃទាំងនេះមិនមែនជាតួលេខប្រកាសដែលបានផ្ទៀងផ្ទាត់ទេ.` : `Your manually entered scenario is ${scenario.label.toLowerCase()} by ${scenario.surprise} percentage points. ${scenario.explanation} These inputs are not verified release figures.`
    : km ? 'CPI វាស់ការប្រែប្រួលតម្លៃទំនិញ និងសេវាកម្មសម្រាប់អ្នកប្រើប្រាស់។ ប្រៀបធៀប Headline និង Core ដាច់ដោយឡែក ហើយប្រើសូចនាករដូចគ្នាប្រចាំខែ ឬធៀបឆ្នាំ។ បញ្ចូលតម្លៃជាក់ស្តែង និងការព្យាករណ៍ក្នុងផ្នែកសេណារីយ៉ូ ដើម្បីស្វែងយល់ពីប្រតិកម្ម FX/Crypto ដែលអាចកើតមាន; ប្រព័ន្ធមិនបង្កើតតួលេខប្រកាសឡើយ។' : 'CPI measures changes in consumer prices. Compare headline and core separately, using the same monthly or yearly measure. Enter actual and forecast in Scenario lab to explore a possible FX/crypto reaction; no release numbers are invented.';
  return km
    ? 'ខ្ញុំអាចឆ្លើយសំណួរដែលគាំទ្រអំពីពេលប្រកាស CPI, សេណារីយ៉ូ CPI, ប្រកាសបណ្ដាញសង្គម, តម្លៃ Crypto ដែលបង្ហាញ និងដែនកំណត់នៃសញ្ញាជួញដូរ។ សូមជ្រើសសំណួរណាមួយខាងលើ។ នេះជាជំនួយការផ្អែកលើច្បាប់ មិនមែន AI ទូទៅទេ។'
    : 'I can answer supported questions about CPI timing, CPI scenarios, recent social posts, displayed crypto prices and trading-signal limitations. Try one of the suggested questions. This is a rule-based assistant, not a general AI model.';
}
