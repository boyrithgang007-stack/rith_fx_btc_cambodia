"use client";

import Link from "next/link";
import { useState } from "react";

export default function VerifyEmailClient() {
  const [message, setMessage] = useState("ចុចប៊ូតុងខាងក្រោម ដើម្បីបញ្ជាក់អ៊ីមែលរបស់អ្នក។");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  async function verifyEmail() {
    setPending(true);
    setError(false);
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setMessage("មិនមានតំណផ្ទៀងផ្ទាត់ទេ។ សូមបើកតំណពីអ៊ីមែលដែលបានទទួល។");
      setError(true);
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "មិនអាចផ្ទៀងផ្ទាត់អ៊ីមែលបានទេ។");
      setMessage(result.message || "អ៊ីមែលបានផ្ទៀងផ្ទាត់។");
      setComplete(true);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់។");
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return <section aria-labelledby="email-verification-heading">
    <p className="connections-eyebrow">RFX TEAM · ACCOUNT SECURITY</p>
    <h1 id="email-verification-heading">ផ្ទៀងផ្ទាត់អ៊ីមែល</h1>
    <p role={error ? "alert" : "status"}>{message}</p>
    {!error && !complete && <button type="button" onClick={() => void verifyEmail()} disabled={pending}>{pending ? "កំពុងផ្ទៀងផ្ទាត់…" : "បញ្ជាក់អ៊ីមែល"}</button>}
    <Link href="/dashboard">ត្រឡប់ទៅចូលគណនី</Link>
  </section>;
}
