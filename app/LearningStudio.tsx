"use client";

import ControlButton from "./ControlButton";

import { useState } from "react";
import Link from "next/link";
import { ThemeModeButton, useAppTheme } from "./ThemeControls";
import { candleDirection, lessonRisk, LEARNING_SOURCES } from "./learning-model";

export default function LearningStudio() {
  const theme=useAppTheme();
  const [km,setKm]=useState(true), [lesson,setLesson]=useState(0);
  const [close,setClose]=useState(108), [scenario,setScenario]=useState(0);
  const [capital,setCapital]=useState(1000), [percent,setPercent]=useState(1);
  const [entry,setEntry]=useState(100), [stop,setStop]=useState(95);
  const [answers,setAnswers]=useState<(number|null)[]>([null,null,null]);
  const titles=km?["អាន Candle","ពិនិត្យតក្កវិជ្ជា","គណនាហានិភ័យ"]:["Read a candle","Check the reasoning","Explore risk"];
  const candle={open:100,high:Math.max(100,close)+6,low:Math.min(100,close)-6,close};
  const direction=candleDirection(candle), risk=lessonRisk(capital,percent,entry,stop);
  const sequences=[[90,95,93,103,99,108],[108,103,105,95,99,90],[98,103,99,102,98,101]];
  const questions=km?[
    {question:"Open = 100 និង Close = 108។ តើ candle នេះប្រាប់អ្វី?",options:["តម្លៃបិទខ្ពស់ជាងតម្លៃបើក","តម្លៃបន្ទាប់ត្រូវតែឡើង","មានការធានាប្រាក់ចំណេញ"],correct:0,why:"Candle ប្រាប់តម្លៃក្នុងរយៈពេលដែលបានកើតរួច។ វាមិនធានាតម្លៃបន្ទាប់ទេ។"},
    {question:"តើក្រាបកន្លងមកដែលឡើង ធានាថាតម្លៃបន្ទាប់នឹងឡើងទេ?",options:["ធានា ព្រោះវាឡើងរួចហើយ","មិនធានាទេ ត្រូវពិនិត្យបរិបទ និងភស្តុតាងផ្សេងទៀត","ធានាប្រសិនបើបន្ថែម leverage"],correct:1,why:"សង្កេតអ្វីដែលបានកើតរួច បែងចែកវាពីការសន្និដ្ឋាន និងពិនិត្យសេណារីយ៉ូផ្ទុយ។"},
    {question:"ទុន $1,000 ហានិភ័យឧទាហរណ៍ 1%។ Entry $100 និង Stop $95។ តើបរិមាណតាមរូបមន្តគឺប៉ុន្មាន?",options:["20 ឯកតា","10 ឯកតា","2 ឯកតា"],correct:2,why:"ថវិកាហានិភ័យ = $10។ ចម្ងាយពី entry ទៅ stop = $5។ $10 ÷ $5 = 2 ឯកតា ដោយមិនទាន់គិតថ្លៃ។"},
  ]:[
    {question:"Open = 100 and Close = 108. What does this candle establish?",options:["The close was above the open","The next price must rise","Profit is guaranteed"],correct:0,why:"A candle describes an observed period. It does not guarantee the next move."},
    {question:"Does a rising historical chart guarantee that the next price will rise?",options:["Yes, because it already rose","No; examine context and other evidence","Yes, if leverage is increased"],correct:1,why:"Separate observed facts from assumptions and consider a scenario that contradicts your conclusion."},
    {question:"Capital $1,000, example risk 1%, entry $100 and stop $95: what quantity follows the formula?",options:["20 units","10 units","2 units"],correct:2,why:"The example budget is $10; the distance to stop is $5. $10 ÷ $5 = 2 units before costs."},
  ];
  const quiz=questions[lesson], answer=answers[lesson];
  const score=answers.filter((value,index)=>value===questions[index].correct).length;
  const y=(value:number)=>240-(value-70)/60*200;
  const format=(value:number)=>value.toLocaleString("en-US",{maximumFractionDigits:4});
  return <main className={`learning-page theme-scope theme-${theme}`} lang={km?"km":"en"}>
    <header className="learning-header"><Link className="welcome-brand" href="/">RFX BTC TEAM<span>LEARNING STUDIO</span></Link><nav><Link href="/dashboard">Dashboard ↗</Link><ControlButton type="button" onClick={()=>setKm(value=>!value)}>{km?"EN":"ខ្មែរ"}</ControlButton><ThemeModeButton/></nav></header>
    <div className="learning-shell"><section className="learning-intro"><div><p className="eyebrow">MARKET LEARNING LAB</p><h1>{km?"សិក្សា។ សាកល្បង។ យល់។":"Learn. Experiment. Understand."}</h1><p>{km?"មេរៀនខ្លី ជាមួយឧទាហរណ៍អន្តរកម្ម ដើម្បីហាត់អានទិន្នន័យ និងពិនិត្យការសន្និដ្ឋាន។":"Short interactive lessons for reading data and checking assumptions."}</p></div><div className="learning-progress"><strong>{score} / 3</strong><span>{km?"លំហាត់ឆ្លើយត្រឹមត្រូវ":"Exercises correct"}</span><progress max="3" value={score} aria-label={km?"វឌ្ឍនភាពលំហាត់":"Exercise progress"}/></div></section>
    <p className="learning-demo-label">{km?"ទិន្នន័យឧទាហរណ៍សម្រាប់សិក្សា · មិនមែនតម្លៃទីផ្សារផ្ទាល់ ឬសញ្ញាទិញលក់":"SYNTHETIC EDUCATIONAL EXAMPLES · NOT LIVE QUOTES OR TRADE SIGNALS"}</p>
    <nav className="learning-tabs" aria-label={km?"ជ្រើសមេរៀន":"Choose a lesson"}>{titles.map((title,index)=><ControlButton key={index} type="button" aria-pressed={lesson===index} onClick={()=>setLesson(index)}><span>0{index+1}</span>{title}<i>{answers[index]===questions[index].correct?"✓":""}</i></ControlButton>)}</nav>
    <div className="learning-layout"><section className="learning-card learning-experiment" aria-labelledby="lesson-heading"><p className="eyebrow">0{lesson+1} / EXPLORE</p><h2 id="lesson-heading">{titles[lesson]}</h2>
      {lesson===0&&<><p>{km?"Open គឺតម្លៃបើក, Close គឺតម្លៃបិទ, High/Low គឺខ្ពស់/ទាបបំផុតក្នុងរយៈពេលមួយ។ រុញ slider ដើម្បីឃើញការប្រែប្រួលរាង candle។":"Open and close mark the beginning and end of a period; high and low mark its extremes. Move the slider to change the candle."}</p><svg className="learning-chart" viewBox="0 0 440 280" role="img" aria-label={`Example candle: open 100, high ${candle.high}, low ${candle.low}, close ${close}`}>
        {[80,100,120].map(value=><g key={value}><line x1="35" x2="400" y1={y(value)} y2={y(value)} className="learning-grid"/><text x="5" y={y(value)+4}>{value}</text></g>)}
        <line x1="180" x2="180" y1={y(candle.high)} y2={y(candle.low)} stroke={direction==="down"?"#cf5263":"#0d9c79"} strokeWidth="3"/>
        <rect x="145" y={y(Math.max(100,close))} width="70" height={Math.max(2,Math.abs(y(close)-y(100)))} fill={direction==="down"?"#cf5263":"#0d9c79"}/>
        <text x="235" y={y(candle.high)+4}>High {candle.high}</text><text x="235" y={y(candle.low)+4}>Low {candle.low}</text><text x="235" y="260">Open 100 · Close {close}</text>
      </svg><label className="learning-slider">Close: <strong>{close}</strong><input type="range" min="85" max="115" value={close} onChange={event=>setClose(Number(event.target.value))}/></label><p className="learning-insight" role="status">{direction==="up"?"Close > Open":direction==="down"?"Close < Open":"Close = Open"} · {km?"បង្ហាញអ្វីដែលកើតរួច មិនព្យាករណ៍ជំហានបន្ទាប់":"Describes the observed period, not the next move"}</p></>}
      {lesson===1&&<><p>{km?"ជ្រើសរើសឧទាហរណ៍។ បែងចែកអ្វីដែលក្រាបបង្ហាញ ពីអ្វីដែលអ្នកសន្និដ្ឋាន។":"Choose an example and separate what the chart shows from what you infer."}</p><div className="learning-scenarios">{(km?["ឡើង","ចុះ","ក្នុងចន្លោះ"]:["Rising","Falling","Range"]).map((title,index)=><ControlButton key={index} type="button" aria-pressed={scenario===index} onClick={()=>setScenario(index)}>{title}</ControlButton>)}</div><svg className="learning-chart" viewBox="0 0 440 260" role="img" aria-label="Synthetic historical price sequence"><line x1="30" x2="410" y1="215" y2="215" className="learning-grid"/><polyline points={sequences[scenario].map((value,index)=>`${35+index*70},${205-(value-85)*6}`).join(" ")} fill="none" stroke="#149e8c" strokeWidth="3"/>{sequences[scenario].map((value,index)=><g key={index}><circle cx={35+index*70} cy={205-(value-85)*6} r="5" fill="#149e8c"/><text x={30+index*70} y={190-(value-85)*6}>{value}</text></g>)}<text x="30" y="245">EXAMPLE ONLY · PAST OBSERVATIONS</text></svg><ol className="learning-reasoning"><li>{km?"សង្កេត៖ តម្លៃណាខ្ពស់/ទាបជាងមុន?":"Observe: which values are higher or lower than before?"}</li><li>{km?"សួរ៖ តើយើងខ្វះព័ត៌មានអ្វី? (ពេលវេលា ប្រភព ថ្លៃ និងបរិបទ)":"Ask: what is missing? Timeframe, source, costs and context."}</li><li>{km?"ផ្ទៀងផ្ទាត់៖ តើភស្តុតាងអ្វីអាចផ្ទុយពីការសន្និដ្ឋាន?":"Check: what evidence could contradict your conclusion?"}</li></ol></>}
      {lesson===2&&<><p>{km?"រូបមន្តឧទាហរណ៍ long សម្រាប់ទ្រព្យដែលគិតជាដុល្លារក្នុងមួយឯកតា។ បរិមាណត្រូវបានកំណត់មិនឱ្យតម្លៃសរុបលើសទុន (គ្មាន leverage)។":"A hypothetical long position in USD per unit. Quantity is capped so notional does not exceed capital, with no leverage."}</p><div className="learning-inputs">{[
        {name:km?"ទុន ($)":"Capital ($)",value:capital,set:setCapital,min:1},
        {name:km?"ហានិភ័យឧទាហរណ៍ (%)":"Example risk (%)",value:percent,set:setPercent,min:.1},
        {name:"Entry ($ / unit)",value:entry,set:setEntry,min:.01},
        {name:"Stop ($ / unit)",value:stop,set:setStop,min:.01},
      ].map(field=><label key={field.name}>{field.name}<input type="number" min={field.min} step="any" value={field.value} onChange={event=>field.set(Number(event.target.value))}/></label>)}</div>{risk?<><dl className="learning-results"><div><dt>{km?"ថវិកាហានិភ័យ":"Risk budget"}</dt><dd>${format(risk.budget)}</dd></div><div><dt>{km?"ចម្ងាយ Entry → Stop":"Entry → stop distance"}</dt><dd>${format(risk.distance)}</dd></div><div><dt>{km?"បរិមាណ (ប្រហែល)":"Quantity (approx.)"}</dt><dd>{format(risk.quantity)}</dd></div><div><dt>{km?"ខាតតាមផែនការ":"Planned loss"}</dt><dd>${format(risk.plannedLoss)}</dd></div></dl><p className="learning-formula">Quantity = min((Capital × Risk% ÷ 100) ÷ (Entry − Stop), Capital ÷ Entry)</p></>:<p role="alert" className="learning-feedback">{km?"បញ្ចូលលេខវិជ្ជមាន, ហានិភ័យ ≤ 100% និង Stop ទាបជាង Entry។":"Use positive numbers, risk ≤ 100%, and a stop below the entry."}</p>}<p className="learning-note">{km?"មិនទាន់គិតថ្លៃ spread/slippage/fees។ Stop មិនធានាកម្រិតខាតទេ; gaps អាចធ្វើឱ្យខាតលើស។ រូបមន្តនេះមិនមែនជាគណនា lot សម្រាប់ broker Forex ទេ។":"Excludes spread, slippage and fees. Stops do not guarantee a loss limit; gaps can exceed it. This is not a broker-specific Forex lot calculator."}</p></>}
    </section><aside className="learning-card learning-quiz"><p className="eyebrow">PRACTICE / CHECK YOUR REASONING</p><h2>{km?"សាកល្បងចំណេះដឹង":"Check your understanding"}</h2><fieldset><legend>{quiz.question}</legend>{quiz.options.map((option,index)=><label key={index} className={answer===index?"is-selected":""}><input type="radio" name={`quiz-${lesson}`} checked={answer===index} onChange={()=>setAnswers(current=>current.map((value,position)=>position===lesson?index:value))}/>{option}</label>)}</fieldset>{answer!==null&&<div className={`learning-feedback ${answer===quiz.correct?"is-correct":""}`} role="status"><strong>{km?answer===quiz.correct?"✓ ត្រឹមត្រូវ":"សាកល្បងម្ដងទៀត":answer===quiz.correct?"✓ Correct":"Try again"}</strong><p>{quiz.why}</p></div>}<div className="learning-quiz-actions">{lesson<2&&<ControlButton type="button" onClick={()=>setLesson(value=>value+1)}>{km?"មេរៀនបន្ទាប់ →":"Next lesson →"}</ControlButton>}<ControlButton type="button" onClick={()=>setAnswers([null,null,null])}>{km?"ចាប់ផ្ដើមលំហាត់ឡើងវិញ":"Reset exercises"}</ControlButton></div><p className="learning-note">{km?"ពិន្ទុរក្សាទុកតែក្នុងទំព័រនេះ។ មិនមែនជាវិញ្ញាបនបត្រវិនិយោគទេ។":"Progress is kept for this page session. This is not an investment qualification."}</p></aside></div>
    <footer className="learning-sources"><h2>{km?"ប្រភពសិក្សាបន្ថែម":"Further reading"}</h2>{LEARNING_SOURCES.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}<Link href="/markets/analysis">{km?"បើកផ្ទាំងវិភាគ":"Open market analysis"} ↗</Link></footer></div>
  </main>;
}
