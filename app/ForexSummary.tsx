"use client";

import ControlButton from "./ControlButton";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatChange } from "./terminal-data";

type Pair = { symbol: string; rate: number; changePercent: number | null };

export default function ForexSummary() {
  const [data, setData] = useState<{ pairs: Pair[]; asOf: string } | null>(null);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/forex", { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error("Forex reference rates are temporarily unavailable.");
        if (!Array.isArray(result.pairs) || !result.pairs.length || typeof result.asOf !== "string"
          || !result.pairs.every((pair: Pair) => typeof pair.symbol === "string" && Number.isFinite(pair.rate) && pair.rate > 0
            && (pair.changePercent === null || Number.isFinite(pair.changePercent)))) {
          throw new Error("The Forex provider returned incomplete rates.");
        }
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Forex unavailable.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [request]);

  return <section className="td-panel td-forex-summary" aria-label="Forex reference rates">
    <div className="td-commodities-heading">
      <div><span className="td-label">FOREX / ECB DAILY REFERENCE</span><h2>រូបិយប័ណ្ណ / Forex</h2></div>
      <Link href="/markets/forex">ALL PAIRS &amp; HISTORY ↗</Link>
    </div>
    {error && <p className="td-commodity-warning" role="status">{error} {data && "Showing last available rates."} <ControlButton type="button" onClick={() => setRequest(value => value + 1)}>RETRY</ControlButton></p>}
    {!data && !error && <p role="status">Loading Forex reference rates…</p>}
    {data && <><div className="td-forex-grid">{data.pairs.map(pair => <Link key={pair.symbol} href="/markets/forex" className="td-fx-pair">
      <b>{pair.symbol}</b><strong>{pair.rate.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong>
      <span className={pair.changePercent === null ? "" : pair.changePercent >= 0 ? "td-green-text" : "td-red-text"}>{pair.changePercent === null ? "Change unavailable" : formatChange(pair.changePercent)}</span>
    </Link>)}</div><p className="td-commodity-disclaimer">ECB via Frankfurter · As of {data.asOf} · Previous publication change · Daily reference rates, not live broker quotes.</p></>}
  </section>;
}
