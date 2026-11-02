"use client";

import ControlButton from "./ControlButton";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { AccountSnapshot, Provider } from "./lib/exchanges/accounts";

type Connection = { id: string; provider: Provider; label: string; createdAt: string };
export default function ConnectedAccounts({ initialProvider = "binance", showForm = true }: { initialProvider?: Provider; showForm?: boolean }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, AccountSnapshot>>({});
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/connections", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setConnections(data.connections);
      })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "មិនអាចទាញបញ្ជីគណនីបានទេ។"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey, apiSecret, passphrase }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConnections(data.connections); setSnapshots({});
      setApiKey(""); setPassphrase("");
      setMessage("បានផ្ទៀងផ្ទាត់ និងភ្ជាប់គណនី។ ចុចមើលសមតុល្យដើម្បីទាញទិន្នន័យថ្មី។");
    } catch(e) { setError(e instanceof Error ? e.message : "ការភ្ជាប់បរាជ័យ។"); }
    finally { setApiSecret(""); setBusy(false); }
  }

  async function refresh(connection: Connection) {
    setBusy(true); setError(""); setMessage("");
    setSnapshots(current => { const next = { ...current }; delete next[connection.id]; return next; });
    try {
      const response = await fetch(`/api/connections/${connection.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSnapshots(current => ({ ...current, [connection.id]: data }));
    } catch(e) { setError(e instanceof Error ? e.message : "មិនអាចទាញសមតុល្យបានទេ។"); }
    finally { setBusy(false); }
  }

  async function disconnect(connection: Connection) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/connections/${connection.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error);
      setConnections(current => current.filter(c => c.id !== connection.id));
      setSnapshots(current => { const next = { ...current }; delete next[connection.id]; return next; });
      setMessage("បានផ្ដាច់ការភ្ជាប់ពីប្រព័ន្ធ។ អ្នកអាចលុប API key នៅលើ Exchange ផងដែរ។");
    } catch(e) { setError(e instanceof Error ? e.message : "មិនអាចផ្ដាច់ការភ្ជាប់បានទេ។"); }
    finally { setBusy(false); }
  }

  return <section className="connected-accounts" aria-label="គណនីដែលបានភ្ជាប់">
    {showForm && <form className="connection-card account-connect-form" onSubmit={connect}>
      <p className="connections-eyebrow">CONNECT YOUR ACCOUNT</p><h2>ភ្ជាប់គណនីពិត</h2>
      <p>ប្រើ API key ដែលមានសិទ្ធិអានតែប៉ុណ្ណោះ។ សម្រាប់ Exness MT5 ប្រើ Investor password។</p>
      <fieldset disabled={busy}>
        <label>គណនី<select value={provider} onChange={e => { setProvider(e.target.value as Provider); setApiKey(""); setApiSecret(""); setPassphrase(""); }}><option value="binance">Binance · Spot</option><option value="okx">OKX · Trading account</option><option value="bitget">Bitget · Classic Spot</option><option value="mt5">Exness · MT5</option></select></label>
        <label>{provider === "mt5" ? "លេខគណនី MT5" : "API key"}<input value={apiKey} onChange={e => setApiKey(e.target.value.trim())} required maxLength={256} autoComplete="off" spellCheck={false} /></label>
        <label>{provider === "mt5" ? "Investor password" : "API secret"}<input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required maxLength={256} autoComplete="off" spellCheck={false} /></label>
        {provider !== "binance" && <label>{provider === "mt5" ? "Exness server (ឧ. Exness-MT5Real…)" : "API passphrase"}<input type={provider === "mt5" ? "text" : "password"} value={passphrase} onChange={e => setPassphrase(e.target.value)} required maxLength={128} autoComplete="off" spellCheck={false} /></label>}
        <ControlButton type="submit">{busy ? "កំពុងផ្ទៀងផ្ទាត់…" : "ផ្ទៀងផ្ទាត់ និងភ្ជាប់"}</ControlButton>
      </fieldset>
      <small>ប្រសិនបើគណនី provider នេះបានភ្ជាប់រួច ការភ្ជាប់ថ្មីនឹងប្ដូរ credentials ចាស់។</small>
    </form>}
    {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-success" role="status">{message}</p>}
    {loading ? <p role="status">កំពុងទាញគណនី…</p> : !connections.length && <p className="connection-empty">មិនទាន់មានគណនីភ្ជាប់។ {showForm ? "ប្រើទម្រង់ខាងលើដើម្បីភ្ជាប់។" : <Link href="/accounts/exchanges">ភ្ជាប់គណនី Exchange</Link>}</p>}
    <div className="connection-grid">{connections.map(connection => {
      const snapshot = snapshots[connection.id];
      return <article className="connection-card" key={connection.id}>
        <div className="connection-card-heading"><h3>{connection.label}</h3><span className="connection-status">បានរក្សាទុក · អានតែប៉ុណ្ណោះ</span></div>
        <div className="connection-actions"><ControlButton disabled={busy} onClick={() => void refresh(connection)}>មើលសមតុល្យ / Refresh</ControlButton><ControlButton variant="danger" disabled={busy} onClick={() => void disconnect(connection)}>ផ្ដាច់ការភ្ជាប់</ControlButton></div>
        {snapshot && <><p className="connection-observed">ទិន្នន័យគិតត្រឹម {new Date(snapshot.observedAt).toLocaleString("km-KH")}</p>
          {snapshot.summary ? <dl className="connection-summary">{Object.entries(snapshot.summary).map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl> : snapshot.balances.length ? <div className="table-scroll"><table className="connection-balances"><thead><tr><th>Asset</th><th>Available</th><th>Locked</th><th>Frozen</th></tr></thead><tbody>{snapshot.balances.map(b => <tr key={b.asset}><td>{b.asset}</td><td>{b.available}</td><td>{b.locked}</td><td>{b.frozen ?? "—"}</td></tr>)}</tbody></table></div> : <p>គណនីនេះមិនមានទ្រព្យសកម្មនៅក្នុង wallet ដែលបានជ្រើសទេ។</p>}</>}
      </article>;
    })}</div>
  </section>;
}
