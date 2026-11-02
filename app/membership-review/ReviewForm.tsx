"use client";

import ControlButton from "../ControlButton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeModeButton, useAppTheme } from "../ThemeControls";

export default function ReviewForm() {
  const theme = useAppTheme();
  const token = useRef("");
  const [review,setReview] = useState<{email:string;expiresAt:number}|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(true);
  const [done,setDone] = useState("");
  const [attempt,setAttempt] = useState(0);
  useEffect(()=>{
    if (!token.current) token.current=window.location.hash.slice(1);
    window.history.replaceState(null,"",window.location.pathname);
    let cancelled=false;
    async function inspect() {
      try {
        const response=await fetch("/api/auth/approval",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:token.current,action:"inspect"}),signal:AbortSignal.timeout(15000)});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error);
        if(!cancelled){setReview(result);setError("");}
      }catch(e){if(!cancelled)setError(e instanceof Error ? e.message : "មិនអាចបើកសំណើបានទេ។");}
      finally{if(!cancelled)setBusy(false);}
    }
    void inspect();return()=>{cancelled=true;};
  },[attempt]);
  async function decide(action:"approved"|"rejected") {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/auth/approval",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:token.current,action}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      setDone(action);token.current="";
    }catch(e){setError(e instanceof Error ? e.message : "មិនអាចរក្សាទុកបានទេ។");}
    finally{setBusy(false);}
  }
  return <main className={`membership-review theme-${theme}`}><section><ThemeModeButton/><p className="eyebrow">RITH FX BTC · MEMBERSHIP REVIEW</p><h1>អនុម័តសមាជិកថ្មី</h1>{done ? <p role="status">{done==="approved" ? "បានអនុម័ត។ សមាជិកអាច Login ចូលឥឡូវនេះ។" : "បានបដិសេធ។ គណនីនេះមិនអាចចូលប្រើបានទេ។"}</p> : <>{busy && <p role="status">កំពុងដំណើរការ…</p>}{review && <><p>អ៊ីមែលអ្នកស្នើ៖ <strong>{review.email}</strong></p><p>តំណផុតកំណត់៖ {new Date(review.expiresAt).toLocaleString()}</p><p>សូមពិនិត្យអ៊ីមែលអ្នកស្នើ រួចជ្រើសរើសសកម្មភាពខាងក្រោម។</p><div className="smc-toolbar"><ControlButton disabled={busy} onClick={()=>void decide("approved")}>✓ Approve · អនុម័ត</ControlButton><ControlButton variant="danger" disabled={busy} onClick={()=>void decide("rejected")}>✕ Reject · បដិសេធ</ControlButton></div></>}{error && <p className="auth-error" role="alert">{error}</p>}{!review && !busy && <ControlButton onClick={()=>{setBusy(true);setAttempt(n=>n+1);}}>ព្យាយាមម្ដងទៀត</ControlButton>}</>}<Link href="/">ត្រឡប់ទៅទំព័រចូលគណនី</Link></section></main>;
}
