"use client";

import ControlButton from "./ControlButton";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import type { PaymentRequest } from "./lib/payments/store";

export default function BankPayments() {
  const [configured,setConfigured]=useState(false);
  const [payments,setPayments]=useState<PaymentRequest[]>([]);
  const [amount,setAmount]=useState("");
  const [currency,setCurrency]=useState("USD");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/payments/aba",{cache:"no-store",signal:controller.signal}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.error);
      if(!controller.signal.aborted){setConfigured(data.configured);setPayments(data.payments);}
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"មិនអាចទាញការទូទាត់បានទេ។");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[]);
  async function create(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const response=await fetch("/api/payments/aba",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount,currency})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setPayments(current=>[data.payment,...current].slice(0,20));setAmount("");
    } catch(e){setError(e instanceof Error?e.message:"មិនអាចបង្កើត QR បានទេ។");}finally{setBusy(false);}
  }
  async function check(payment:PaymentRequest) {
    setBusy(true);setError("");
    try {
      const response=await fetch(`/api/payments/${payment.id}`,{method:"POST"});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setPayments(current=>current.map(p=>p.id===payment.id?data.payment:p));
    }catch(e){setError(e instanceof Error?e.message:"មិនអាចផ្ទៀងផ្ទាត់បានទេ។");}finally{setBusy(false);}
  }
  return <section className="connected-accounts" aria-label="ការទទួលការទូទាត់">
    <form className="connection-card account-connect-form" onSubmit={create}>
      <p className="connections-eyebrow">ABA PAYWAY · KHQR</p><h2>ទទួលការទូទាត់ពីអតិថិជន</h2><p>ការទូទាត់ចូលគណនី merchant ដែលអ្នកគ្រប់គ្រងបានកំណត់សម្រាប់ប្រព័ន្ធនេះ។</p>
      {loading ? <p role="status">កំពុងពិនិត្យសេវា…</p> : !configured && <p>ត្រូវកំណត់ ABA merchant ID និង API key នៅលើ server ជាមុន។</p>}
      <fieldset disabled={busy || loading || !configured}><label>ចំនួនទឹកប្រាក់<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} required placeholder={currency==="USD"?"10.00":"40000"}/></label><label>រូបិយប័ណ្ណ<select value={currency} onChange={e=>setCurrency(e.target.value)}><option>USD</option><option>KHR</option></select></label><ControlButton type="submit">បង្កើត QR សម្រាប់ទទួលការទូទាត់</ControlButton></fieldset>
    </form>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="connection-grid">{payments.map(payment=><article className="connection-card" key={payment.id}>
      <h3>{payment.amount} {payment.currency}</h3><p>{payment.mode==="sandbox"?"SANDBOX · សាកល្បង":"LIVE · ការទូទាត់ពិត"}</p><p className="payment-reference">លេខយោង៖ {payment.id}</p><p>បង្កើតនៅ៖ {new Date(payment.createdAt).toLocaleString("km-KH")}</p>
      <p role="status">{payment.status==="paid"?"បានផ្ទៀងផ្ទាត់ការទូទាត់ពី ABA":payment.status==="pending"?"រង់ចាំការទូទាត់":payment.status==="failed"?"ការបង្កើត QR បរាជ័យ":"កំពុងបង្កើត"}</p>
      {payment.qrImage && payment.status!=="paid" && <Image className="bank-payment-qr" src={payment.qrImage} alt={`ABA KHQR ${payment.amount} ${payment.currency}`} width={280} height={280} unoptimized/>}
      <ControlButton disabled={busy} onClick={()=>void check(payment)}>ផ្ទៀងផ្ទាត់ជាមួយ ABA</ControlButton>
      <small>QR មានអាយុកាល ១៥ នាទី។ ស្ថានភាពត្រូវផ្ទៀងផ្ទាត់ជាមួយ ABA មុនចាត់ទុកថាបានបង់។</small>
    </article>)}</div>
  </section>;
}
