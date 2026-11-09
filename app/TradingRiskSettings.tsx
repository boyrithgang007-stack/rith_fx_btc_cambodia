"use client";

import { useEffect, useState, type FormEvent } from "react";
import ControlButton from "./ControlButton";

type Settings = { maxOrderUsd: number; dailyLimitUsd: number; updatedAt: string | null };
const DEFAULTS: Settings = { maxOrderUsd: 50, dailyLimitUsd: 200, updatedAt: null };

export default function TradingRiskSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [maxOrder, setMaxOrder] = useState(String(DEFAULTS.maxOrderUsd));
  const [dailyLimit, setDailyLimit] = useState(String(DEFAULTS.dailyLimitUsd));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/trading/settings", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "មិនអាចទាញការកំណត់ហានិភ័យបានទេ។");
        const next = data.settings as Settings;
        if (!Number.isFinite(next.maxOrderUsd) || !Number.isFinite(next.dailyLimitUsd)) throw new Error("ទិន្នន័យកំណត់ហានិភ័យមិនត្រឹមត្រូវទេ។");
        if (!controller.signal.aborted) {
          setSettings(next);
          setMaxOrder(String(next.maxOrderUsd));
          setDailyLimit(String(next.dailyLimitUsd));
        }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "មិនអាចទាញការកំណត់ហានិភ័យបានទេ។"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/trading/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxOrderUsd: Number(maxOrder), dailyLimitUsd: Number(dailyLimit) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "មិនអាចរក្សាទុកការកំណត់បានទេ។");
      setSettings(data.settings as Settings);
      setMessage("បានរក្សាទុកកម្រិតកំណត់។");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចរក្សាទុកការកំណត់បានទេ។");
    } finally {
      setSaving(false);
    }
  }

  return <article className="settings-card trading-risk-card">
    <div className="settings-card-heading"><div><p className="eyebrow">DEMO FIRST · ORDER RISK</p><h2>កម្រិតហានិភ័យជួញដូរ</h2><p>កំណត់ដែនកំណត់ USD សម្រាប់ការរៀបចំសាកល្បង Demo/Testnet។</p></div></div>
    <p className="trading-risk-status" role="status">Demo/Testnet មុន · ការដាក់បញ្ជាទិញនៅមិនទាន់បើកទេ។ គណនីដែលភ្ជាប់បច្ចុប្បន្ននៅតែអានតែប៉ុណ្ណោះ។</p>
    <form className="trading-risk-form" onSubmit={(event) => void save(event)}>
      <label className="settings-field">Notional អតិបរមាក្នុងមួយ order (USD)<input type="number" min="1" max="100000" step="0.01" value={maxOrder} onChange={event => setMaxOrder(event.target.value)} required disabled={loading || saving} /></label>
      <label className="settings-field">Notional សរុបអតិបរមាប្រចាំថ្ងៃ (USD)<input type="number" min="1" max="1000000" step="0.01" value={dailyLimit} onChange={event => setDailyLimit(event.target.value)} required disabled={loading || saving} /></label>
      <div className="trading-risk-guidance">
        <p><strong>ចំណាំ</strong><span>កម្រិតសរុបប្រចាំថ្ងៃ ត្រូវស្មើ ឬខ្ពស់ជាងកម្រិតក្នុងមួយ order។</span></p>
        <div className="trading-risk-defaults"><span>តម្លៃដើម</span><strong>${DEFAULTS.maxOrderUsd} / order</strong><span aria-hidden="true">·</span><strong>${DEFAULTS.dailyLimitUsd} / ថ្ងៃ</strong></div>
      </div>
      {settings.updatedAt && <p className="settings-hint">រក្សាទុកចុងក្រោយ៖ {new Date(settings.updatedAt).toLocaleString("km-KH")}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-success" role="status">{message}</p>}
      <div className="trading-risk-actions">
        <ControlButton variant="primary" className="settings-primary-button" type="submit" disabled={loading || saving}>{loading ? "កំពុងទាញ…" : saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកការកំណត់"}</ControlButton>
      </div>
    </form>
  </article>;
}
