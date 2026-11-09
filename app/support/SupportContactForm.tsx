"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import ControlButton from "../ControlButton";

export default function SupportContactForm({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const detail = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error : "មិនអាចផ្ញើសារបានទេ។";
        throw new Error(detail);
      }
      setMessage("");
      setStatus("បានផ្ញើសារទៅកាន់ Support រួចរាល់។ យើងនឹងឆ្លើយតបទៅអ៊ីមែលគណនីរបស់អ្នក។");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចផ្ញើសារបានទេ។ សូមសាកល្បងម្ដងទៀត។");
    } finally {
      setBusy(false);
    }
  }

  return <main className="support-page">
    <section className="support-card" aria-labelledby="support-title">
      <Link href="/dashboard" className="support-back">← ត្រឡប់ទៅ Dashboard</Link>
      <p className="support-eyebrow">RFX BTC TEAM · CUSTOMER CARE</p>
      <h1 id="support-title">ទាក់ទង Support</h1>
      <p>ផ្ញើសំណួរ ឬបញ្ហារបស់អ្នកមកកាន់ភ្នាក់ងារ Support។ យើងនឹងឆ្លើយតបតាមអ៊ីមែលគណនីរបស់អ្នក។</p>
      <form onSubmit={submit}>
        <label className="support-email-field">អ៊ីមែលសម្រាប់ទទួលចម្លើយ<input value={email} readOnly /></label>
        <label className="support-message-field">សាររបស់អ្នក<textarea value={message} onChange={event => setMessage(event.target.value)} minLength={1} maxLength={2000} rows={7} required placeholder="សូមពណ៌នាសំណួរ ឬបញ្ហាដែលអ្នកត្រូវការជំនួយ…" /></label>
        <div className="support-form-footer">
          <span>{message.length}/2000</span>
          <ControlButton variant="primary" type="submit" disabled={busy || !message.trim()}>{busy ? "កំពុងផ្ញើ…" : "ផ្ញើទៅ Support →"}</ControlButton>
        </div>
      </form>
      {status && <p className="support-status" role="status">{status}</p>}
      {error && <p className="support-error" role="alert">{error}</p>}
    </section>
  </main>;
}
