"use client";
import {useEffect,useRef,useState,type ChangeEvent} from "react";
import Image from "next/image";
import ControlButton from "./ControlButton";
import type {ImageAnalysisReport} from "./image-analysis-types";
export default function ImageAnalysisPanel({configured}:{configured:boolean}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState("");
  const [question,setQuestion]=useState(""),[result,setResult]=useState<ImageAnalysisReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const previewRef=useRef(""),request=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{request.current?.abort();if(previewRef.current)URL.revokeObjectURL(previewRef.current);},[]);
  function clear(){if(previewRef.current)URL.revokeObjectURL(previewRef.current);previewRef.current="";setPreview("");setFile(null);setResult(null);setError("");if(input.current)input.current.value="";}
  function choose(event:ChangeEvent<HTMLInputElement>){
    const selected=event.target.files?.[0];if(!selected)return;
    clear();
    if(!["image/png","image/jpeg","image/webp"].includes(selected.type)||selected.size>4*1024*1024||selected.size===0){setError("សូមជ្រើស PNG, JPEG ឬ WebP មិនលើស 4 MB។");return;}
    const url=URL.createObjectURL(selected);previewRef.current=url;setPreview(url);setFile(selected);
  }
  async function analyze(){
    if(!file)return;setBusy(true);setError("");setResult(null);
    request.current?.abort();const controller=new AbortController();request.current=controller;
    try{
      const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error("មិនអាចអានឯកសាររូបបាន។"));reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(Error("Invalid image."));reader.readAsDataURL(file);});
      if(controller.signal.aborted)return;
      const response=await fetch("/api/image-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,question}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)])});
      const value=await response.json();if(!response.ok)throw Error(value.error||"Image analysis unavailable.");
      if(!value.id||!value.evidence||value.basis!=="image-only"||value.tradeAction!=="WAIT")throw Error("Invalid image analysis response.");
      if(!controller.signal.aborted)setResult(value);
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"មិនអាចវិភាគរូបបាន។");}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <section className="image-analysis-panel" aria-labelledby="image-analysis-title"><div className="image-analysis-heading"><div><p className="eyebrow">CHART / IMAGE ANALYSIS</p><h3 id="image-analysis-title">អានរូបក្រាប និងរូបទិន្នន័យ</h3><p>បញ្ចូលរូប screenshot ក្រាប candles ឬតារាង ដើម្បីអានអក្សរ លេខ និងពន្យល់អ្វីដែលមើលឃើញ។</p></div><span className="signal-paper-badge">IMAGE ONLY</span></div>
    <div className="image-analysis-actions"><label className="image-upload-control" data-ui-control="secondary" data-ui-size="md">ជ្រើសរូបភាព<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={choose}/></label><ControlButton disabled={!file||busy} onClick={clear}>ដករូបចេញ</ControlButton><span>PNG / JPEG / WebP · ≤ 4 MB · 80–4096px</span></div>
    {preview&&<div className="image-analysis-preview"><Image src={preview} alt="រូបដែលបានជ្រើសសម្រាប់ អានទិន្នន័យ" width={1200} height={800} unoptimized/><p>{file?.name} · {file?Math.ceil(file.size/1024):0} KB</p></div>}
    <label className="image-analysis-question" htmlFor="image-analysis-question">ចំណុចចង់ឱ្យ ពិនិត្យ (ជាជម្រើស)<textarea id="image-analysis-question" rows={3} maxLength={500} disabled={busy} value={question} onChange={e=>{setQuestion(e.target.value);setResult(null);}} placeholder="ឧទាហរណ៍៖ អានតម្លៃ និង timeframe ដែលមើលឃើញ ហើយពន្យល់ទិសដៅកន្លងមក។"/></label>
    <div className="image-analysis-how-it-works"><h4>របៀបដែល Bot វិភាគរូបភាព</h4><p>ជ្រើសរូបក្រាហ្វដែលមានតម្លៃ និង timeframe ច្បាស់ រួចចុច «វិភាគរូបភាព»។ Bot អាន candle អក្សរ និងតម្លៃដែលមើលឃើញ ហើយពន្យល់ទិសដៅក្នុងរូប ព្រមទាំងចំណុចដែលត្រូវពិនិត្យបន្ថែម។ ប្រសិនបើព័ត៌មានមិនច្បាស់ Bot នឹងប្រាប់ថាមិនអាចបញ្ជាក់បាន។</p><p>សម្រាប់ Buy / Sell ជាមួយ Entry, SL និង TP សូមប្រើការវិភាគ candle ខាងលើ ដែលផ្ទៀងផ្ទាត់ទិន្នន័យពីប្រភពទីផ្សារ។</p></div>
    <ControlButton variant="primary" disabled={!file||busy||!configured} onClick={()=>void analyze()}>{busy?"កំពុងអានរូប…":"វិភាគរូបភាព"}</ControlButton>
    {error&&<p className="signal-error" role="alert">{error}</p>}
    {result&&<div className="image-analysis-result" role="status"><div className="image-analysis-heading"><h3>លទ្ធផលអានរូប</h3><span className="signal-paper-badge">{result.evidence.readability.toUpperCase()} · {result.evidence.kind}</span></div><p>{result.evidence.summary}</p><dl className="image-analysis-facts"><div><dt>Symbol ដែលអានបាន</dt><dd>{result.evidence.symbol??"មិនច្បាស់"}</dd></div><div><dt>Timeframe ដែលអានបាន</dt><dd>{result.evidence.timeframe??"មិនច្បាស់"}</dd></div><div><dt>ទិសដៅដែលមើលឃើញ</dt><dd>{result.evidence.trend}</dd></div></dl>
      {result.evidence.visibleValues.length>0&&<div className="table-scroll"><table><caption>តម្លៃដែលមើលឃើញក្នុងរូប · ត្រូវផ្ទៀងផ្ទាត់ជាមួយប្រភពដើម</caption><thead><tr><th>ស្លាក</th><th>តម្លៃដែលអានបាន</th><th>ឯកតា</th></tr></thead><tbody>{result.evidence.visibleValues.map((item,i)=><tr key={i}><td>{item.label}</td><td>{item.value??"មិនអាចអានបាន"}</td><td>{item.unit??"—"}</td></tr>)}</tbody></table></div>}
      {result.evidence.visibleText.length>0&&<details><summary>អក្សរដែលអានបាន</summary><ul>{result.evidence.visibleText.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
      {result.evidence.observations.length>0&&<><h4>ការសង្កេត</h4><ul>{result.evidence.observations.map((text,i)=><li key={i}>{text}</li>)}</ul></>}
      <h4>កម្រិតនៃការអានរូប</h4><ul>{result.evidence.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul><p>រូប screenshot មិនអាចបញ្ជាក់ថាទិន្នន័យជាតម្លៃបច្ចុប្បន្ន ឬ candle បានបិទទេ។ លទ្ធផលរូបមិនបង្កើតសញ្ញា BUY/SELL ឬ Entry/SL/TP ដោយផ្ទាល់ទេ។</p><p className="signal-meta">{result.width} × {result.height}px · {new Date(result.createdAt).toLocaleString("en-GB",{timeZone:"Asia/Bangkok"})} UTC+7</p>
    </div>}
  </section>;
}
