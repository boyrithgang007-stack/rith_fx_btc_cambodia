"use client";

import { useEffect, useState } from "react";

type MarketQuote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  asOf: number;
  source: string;
  delayed: boolean;
};

const SYMBOL_ORDER = ["ETHUSDT", "EURUSD", "GBPUSD", "USOIL", "XAUUSD", "BTCUSDT"];

function isMarketQuote(value: unknown): value is MarketQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Record<string, unknown>;
  return SYMBOL_ORDER.includes(String(quote.symbol))
    && typeof quote.price === "number"
    && Number.isFinite(quote.price)
    && quote.price > 0
    && (quote.changePercent === null || (typeof quote.changePercent === "number" && Number.isFinite(quote.changePercent)))
    && typeof quote.asOf === "number"
    && Number.isFinite(quote.asOf)
    && typeof quote.source === "string"
    && typeof quote.delayed === "boolean";
}

function formatPrice(quote: MarketQuote) {
  const fractionDigits = quote.symbol === "BTCUSDT" ? 0
    : quote.symbol === "ETHUSDT" || quote.symbol === "USOIL" || quote.symbol === "XAUUSD" ? 2
      : 4;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(quote.price);
}

function QuoteItems({ quotes }: { quotes: MarketQuote[] }) {
  return <>{quotes.map((quote) => (
    <li className="welcome-market-quote" key={quote.symbol} title={`${quote.source} · ${new Date(quote.asOf).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} UTC+7`}>
      <strong>{quote.symbol}</strong>
      <span className="welcome-market-price">{formatPrice(quote)}</span>
      {quote.delayed && <span className="welcome-market-delayed">DELAYED</span>}
      <span className={`welcome-market-change ${quote.changePercent === null ? "is-neutral" : quote.changePercent >= 0 ? "is-positive" : "is-negative"}`}>
        {quote.changePercent === null ? "—" : `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`}
      </span>
    </li>
  ))}</>;
}

export default function MarketTicker() {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadQuotes() {
      try {
        const response = await fetch("/api/market-ticker", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok || !payload || typeof payload !== "object" || !Array.isArray((payload as { quotes?: unknown }).quotes)) {
          throw new Error("Market quotes could not be loaded.");
        }
        const nextQuotes = ((payload as { quotes: unknown[] }).quotes)
          .filter(isMarketQuote)
          .sort((a, b) => SYMBOL_ORDER.indexOf(a.symbol) - SYMBOL_ORDER.indexOf(b.symbol));
        if (!nextQuotes.length) throw new Error("No market quotes were returned.");
        if (!controller.signal.aborted) {
          setQuotes(nextQuotes);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadQuotes();
    const timer = window.setInterval(() => void loadQuotes(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const status = error
    ? "Market quotes could not be refreshed. Showing the last loaded prices when available."
    : loading
      ? "Loading market quotes."
      : "Market quotes refreshed.";

  return <section className="welcome-market-ticker" aria-label="Market prices" aria-busy={loading}>
    {quotes.length ? <>
      <div className="welcome-market-track">
        <ul className="welcome-market-quote-list"><QuoteItems quotes={quotes}/></ul>
        <ul className="welcome-market-quote-list" aria-hidden="true"><QuoteItems quotes={quotes}/></ul>
      </div>
    </> : <p className="welcome-market-status">{error ? "Market data temporarily unavailable" : "Loading market data…"}</p>}
    <span className="welcome-market-sr-status" role="status">{status}</span>
  </section>;
}
