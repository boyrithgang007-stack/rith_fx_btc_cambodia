"use client";

import ControlButton from "./ControlButton";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Settings = { symbol: string; capitalUsd: number; riskPercent: number; leverage: number; enabled: boolean; updatedAt: string | null };
type Run = { symbol: string; candleTime: number; status: string; message: string; orderId: string | null; createdAt: string };
type Audit = { action: string; createdAt: string };
type Snapshot = { settings: Settings; automationAvailable: boolean; encryptionConfigured: boolean; credentialsConfigured: boolean; testnetVerified: boolean; workerRunning: boolean; runs: Run[]; audit: Audit[] };

const initialSettings: Settings = { symbol: "BTCUSDT", capitalUsd: 100, riskPercent: 1, leverage: 3, enabled: false, updatedAt: null };

export default function EaBotPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [settings, setSettings] = useState(initialSettings);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal?: AbortSignal, syncSettings = true) => {
    const response = await fetch("/api/ea", { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "មិនអាចទាញស្ថានភាព EA បានទេ។");
    setSnapshot(data);
    if (syncSettings) setSettings(data.settings);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => {
      void load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "មិនអាចទាញស្ថានភាព EA បានទេ។"); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    const timer = window.setInterval(() => {
      void load(controller.signal, false).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "មិនអាចធ្វើបច្ចុប្បន្នភាពស្ថានភាព EA បានទេ។"); });
    }, 30000);
    return () => { controller.abort(); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: { settings: Settings; credentials?: { apiKey: string; apiSecret: string } } = { settings };
      if (apiKey || apiSecret) {
        if (!apiKey || !apiSecret) throw new Error("សូមបញ្ចូល Testnet API key និង secret ទាំងពីរ។");
        body.credentials = { apiKey, apiSecret };
      }
      const response = await fetch("/api/ea", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "មិនអាចរក្សាទុកការកំណត់ EA បានទេ។");
      setSnapshot(data);
      setSettings(data.settings);
      setApiKey("");
      setApiSecret("");
      setMessage(data.settings.enabled ? "EA បានដំណើរការនៅ Binance Futures Testnet ប៉ុណ្ណោះ។" : "បានរក្សាទុកការកំណត់។ EA នៅតែបិទ។");
    } catch (e) { setError(e instanceof Error ? e.message : "ការរក្សាទុកការកំណត់បរាជ័យ។"); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ea", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "មិនអាចដក Testnet key បានទេ។");
      await load();
      setSettings(current => ({ ...current, enabled: false }));
      setMessage("បានដក Testnet credentials ហើយ EA ត្រូវបានបិទ។");
    } catch (e) { setError(e instanceof Error ? e.message : "មិនអាចដក Testnet key បានទេ។"); }
    finally { setBusy(false); }
  }

  return <section className="ea-bot" aria-labelledby="ea-bot-title">
    <div className="ea-bot-heading">
      <div><p className="eyebrow">BINANCE USDⓈ-M FUTURES · AUTOMATION</p><h3 id="ea-bot-title">EA Bot · Testnet</h3></div>
      <span className={settings.enabled && snapshot?.testnetVerified && snapshot?.workerRunning ? "ea-state ea-state-on" : "ea-state"}>{settings.enabled && snapshot?.testnetVerified && snapshot?.workerRunning ? "TESTNET RUNNING" : settings.enabled && !snapshot?.automationAvailable ? "WORKER UNAVAILABLE" : settings.enabled ? "WORKER STARTING" : "DISABLED"}</span>
    </div>
    <p className="ea-bot-notice">ដំណាក់កាលនេះប្រើ Testnet ប៉ុណ្ណោះ — មិនអាចដាក់ order លើគណនីពិតបានទេ។ Live mode ត្រូវការការសាកល្បង Testnet និងការបើកដោយដៃដាច់ដោយឡែក។ Futures មានហានិភ័យខ្ពស់ ហើយអាចបាត់បង់ដើមទុនទាំងស្រុង។</p>
    {!loading && <div className="ea-readiness" aria-label="ស្ថានភាពត្រៀមប្រើ EA">
      <span className={snapshot?.encryptionConfigured ? "ready" : "missing"}>{snapshot?.encryptionConfigured ? "✓ Server encryption ready" : "× Server encryption missing"}</span>
      <span className={snapshot?.credentialsConfigured ? "ready" : "missing"}>{snapshot?.credentialsConfigured ? "✓ Testnet key saved" : "× Testnet key not connected"}</span>
      <span className={snapshot?.testnetVerified ? "ready" : "missing"}>{snapshot?.testnetVerified ? "✓ Testnet verified" : "× Testnet not verified"}</span>
      {!snapshot?.automationAvailable && <span className="missing">× Vercel cannot run the continuous EA worker</span>}
    </div>}
    {error && <p className="ea-message ea-error" role="alert">{error}</p>}
    {message && <p className="ea-message" role="status">{message}</p>}
    {loading ? <p role="status">កំពុងទាញស្ថានភាព EA…</p> : <form onSubmit={save}>
      <div className="ea-fields">
        <label>Binance Futures symbol<select value={settings.symbol} disabled={busy} onChange={event => setSettings(current => ({ ...current, symbol: event.target.value }))}>
          <option value="BTCUSDT">BTCUSDT</option><option value="ETHUSDT">ETHUSDT</option><option value="BNBUSDT">BNBUSDT</option><option value="SOLUSDT">SOLUSDT</option><option value="XRPUSDT">XRPUSDT</option>
        </select></label>
        <label>ដើមទុនកំណត់ ($)<input type="number" min="1" max="1000000" step="0.01" value={settings.capitalUsd} disabled={busy} onChange={event => setSettings(current => ({ ...current, capitalUsd: Number(event.target.value) }))} /></label>
        <label>Risk / order (%) · អតិបរមា 1%<input type="number" min="0.1" max="1" step="0.1" value={settings.riskPercent} disabled={busy} onChange={event => setSettings(current => ({ ...current, riskPercent: Number(event.target.value) }))} /></label>
        <label>Leverage · អតិបរមា 5x<select value={settings.leverage} disabled={busy} onChange={event => setSettings(current => ({ ...current, leverage: Number(event.target.value) }))}>
          {[1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value}x</option>)}
        </select></label>
      </div>
      <div className="ea-credentials">
        <label>Testnet API key<input value={apiKey} onChange={event => setApiKey(event.target.value.trim())} autoComplete="off" maxLength={256} spellCheck={false} /></label>
        <label>Testnet API secret<input type="password" value={apiSecret} onChange={event => setApiSecret(event.target.value)} autoComplete="new-password" maxLength={256} spellCheck={false} /></label>
        <p>{snapshot?.credentialsConfigured ? snapshot.testnetVerified ? "Testnet account verified · credentials encrypted on this server." : "Testnet key saved but requires verification." : "បញ្ចូល API key/secret របស់ Binance Futures Testnet។ កុំប្រើ API key គណនីពិត ឬបើក withdrawal permission។"}</p>
      </div>
      <div className="ea-footer">
        <label className="ea-toggle"><input type="checkbox" checked={settings.enabled} disabled={busy || (!snapshot?.automationAvailable && !settings.enabled) || (!snapshot?.credentialsConfigured && !(apiKey && apiSecret)) || (settings.enabled && !snapshot?.testnetVerified)} onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))} /> បើក automatic Testnet EA</label>
        <div><ControlButton type="submit" disabled={busy}>{busy ? "កំពុងផ្ទៀងផ្ទាត់…" : "រក្សាទុក / ផ្ទៀងផ្ទាត់"}</ControlButton>
          {snapshot?.credentialsConfigured && <ControlButton type="button" variant="danger" disabled={busy} onClick={() => void disconnect()}>ដក Testnet key</ControlButton>}
        </div>
      </div>
    </form>}
    <div className="ea-guards"><span>Risk 1% max</span><span>Reward / Risk 1:2</span><span>Leverage ≤ 5x</span><span>Daily loss ≤ 3%</span><span>Daily PnL must be positive</span><span>Reset: Asia/Phnom_Penh</span></div>
    <div className="ea-runs"><h4>ការដំណើរការថ្មីៗ</h4>
      {!snapshot?.runs.length ? <p>មិនទាន់មានការដាក់ order ឬ signal ដែលបានបញ្ជាក់នៅឡើយទេ។</p> : <ul>{snapshot.runs.map((run, index) => <li key={`${run.candleTime}-${index}`}><strong>{run.symbol} · {run.status.toUpperCase()}</strong><span>{run.message}</span><small>{new Date(run.createdAt).toLocaleString("km-KH")}{run.orderId ? ` · Order ${run.orderId}` : ""}</small></li>)}</ul>}
    </div>
    {!!snapshot?.audit.length && <div className="ea-audit"><h4>Audit log</h4><ul>{snapshot.audit.slice(0, 5).map((event, index) => <li key={`${event.createdAt}-${index}`}><span>{event.action}</span><small>{new Date(event.createdAt).toLocaleString("km-KH")}</small></li>)}</ul></div>}
  </section>;
}
