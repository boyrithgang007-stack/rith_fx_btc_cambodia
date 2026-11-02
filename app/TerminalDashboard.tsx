"use client";

import ControlButton from "./ControlButton";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import ForexSummary from "./ForexSummary";
import WorldGlobe from "./WorldGlobe";
import { buildGalaxyQuotes } from "./galaxy-quotes";
import MarketBriefing, { useEconomicFeeds } from "./MarketBriefing";
import { buildOrbitStories } from "./orbit-stories";
import OverviewAnalytics, { ReferenceAssetDetails } from "./OverviewAnalytics";
import {
  createDemoOrderBook,
  fetchCommodityQuotes,
  fetchTerminalCandles,
  formatChange,
  formatCompactUsd,
  formatTerminalPrice,
  type CommodityQuote,
  type TerminalAsset,
  type TerminalCandle,
  type TerminalRange,
} from "./terminal-data";

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return <span className="td-spark-empty">NO SERIES</span>;
  const low = Math.min(...values);
  const spread = Math.max(...values) - low || 1;
  const points = values.map((value, index) =>
    `${(index / (values.length - 1)) * 100},${30 - ((value - low) / spread) * 26}`,
  ).join(" ");
  return (
    <svg className={`td-sparkline ${positive ? "is-up" : "is-down"}`} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function PriceChart({ candles }: { candles: TerminalCandle[] }) {
  if (candles.length < 2) return <div className="td-empty">Not enough OHLC data to draw this chart.</div>;
  const low = Math.min(...candles.map(({ low: value }) => value));
  const high = Math.max(...candles.map(({ high: value }) => value));
  const spread = high - low || high * 0.01 || 1;
  const y = (value: number) => 215 - ((value - low) / spread) * 185;
  const step = 870 / candles.length;
  const bodyWidth = Math.max(2, Math.min(9, step * 0.58));
  const dateLabel = (time: number) => new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="td-chart">
      <svg viewBox="0 0 1000 248" preserveAspectRatio="none" role="img" aria-label="Candlestick price chart with close-price gradient area">
        <defs><linearGradient id="overview-close-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#A855F7" stopOpacity=".34"/><stop offset="1" stopColor="#EC4899" stopOpacity="0"/></linearGradient></defs>
        <polygon className="glass-area-fill" points={`22,215 ${candles.map((candle,index)=>`${22+step*(index+.5)},${y(candle.close)}`).join(" ")} ${22+step*(candles.length-.5)},215`} fill="url(#overview-close-area)"/>
        <polyline className="glass-price-line" points={candles.map((candle,index)=>`${22+step*(index+.5)},${y(candle.close)}`).join(" ")} fill="none" stroke="#A855F7" strokeWidth="1.5" pathLength="1"/>
        {[0, 1, 2, 3].map((index) => {
          const value = high - (spread * index) / 3;
          const yPosition = y(value);
          return (
            <g key={index}>
              <line x1="20" x2="915" y1={yPosition} y2={yPosition} className="td-grid-line" />
              <text x="924" y={yPosition + 3} className="td-axis-label">{formatTerminalPrice(value)}</text>
            </g>
          );
        })}
        {candles.map((candle, index) => {
          const center = 22 + step * (index + 0.5);
          const up = candle.close >= candle.open;
          const color = up ? "#37d69a" : "#f05d67";
          const top = y(Math.max(candle.open, candle.close));
          const height = Math.max(1.4, Math.abs(y(candle.open) - y(candle.close)));
          return (
            <g key={candle.time} className="td-candle">
              <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1.2" />
              <rect x={center - bodyWidth / 2} y={top} width={bodyWidth} height={height} fill={up ? color : "transparent"} stroke={color} strokeWidth="1">
                <title>{new Date(candle.time).toLocaleString()} · O {formatTerminalPrice(candle.open)} · H {formatTerminalPrice(candle.high)} · L {formatTerminalPrice(candle.low)} · C {formatTerminalPrice(candle.close)}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="td-chart-axis"><span>{dateLabel(candles[0].time)}</span><span>{dateLabel(candles[Math.floor(candles.length / 2)].time)}</span><span>{dateLabel(candles[candles.length - 1].time)}</span></div>
      <div className="td-chart-tip">HOVER A CANDLE FOR OHLC</div>
    </div>
  );
}

function CommoditySeriesChart({ quote, range }: { quote: CommodityQuote; range: TerminalRange }) {
  const days = range === "30" ? 30 : 7;
  const lastTime = quote.history[quote.history.length - 1]?.time ?? quote.asOf;
  const series = quote.history.filter((point) => point.time >= lastTime - days * 86_400_000);
  if (series.length < 2) return <div className="td-empty">Not enough historical reference data to draw this chart.</div>;

  const values = series.map((point) => point.price);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || high * .01 || 1;
  const x = (index: number) => 34 + (index / (series.length - 1)) * 866;
  const y = (value: number) => 215 - ((value - low) / spread) * 182;
  const points = series.map((point, index) => `${x(index)},${y(point.price)}`).join(" ");
  const positive = series[series.length - 1].price >= series[0].price;
  const stroke = positive ? "#42d99b" : "#f06b73";

  return (
    <div className="td-chart">
      <svg viewBox="0 0 1000 248" preserveAspectRatio="none" role="img" aria-label={`${quote.name} daily historical reference prices`}>
        <defs>
          <linearGradient id="td-commodity-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity=".25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((index) => {
          const value = high - (spread * index) / 3;
          const yPosition = y(value);
          return <g key={index}><line x1="20" x2="970" y1={yPosition} y2={yPosition} className="td-grid-line" /><text x="924" y={yPosition + 3} className="td-axis-label">{formatTerminalPrice(value)}</text></g>;
        })}
        <polygon points={`${x(0)},215 ${points} ${x(series.length - 1)},215`} fill="url(#td-commodity-chart-fill)" />
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {series.map((point, index) => <circle key={point.time} cx={x(index)} cy={y(point.price)} r="3" fill={stroke}><title>{new Date(point.time).toLocaleDateString()} · {formatTerminalPrice(point.price)}</title></circle>)}
      </svg>
      <div className="td-chart-axis"><span>{new Date(series[0].time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span>{new Date(series[Math.floor(series.length / 2)].time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span>{new Date(series[series.length - 1].time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
      <div className="td-chart-tip">HOVER A POINT FOR DAILY REFERENCE PRICE</div>
    </div>
  );
}

function DistributionChart({ assets }: { assets: TerminalAsset[] }) {
  const changes = assets
    .map((asset) => asset.price_change_percentage_24h)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (changes.length < 2) return <div className="td-empty">Market breadth is not available yet.</div>;
  const sorted = [...changes].sort((a, b) => a - b);
  const values = Array.from({ length: 28 }, (_, index) => {
    const sample = sorted[Math.round((index / 27) * (sorted.length - 1))];
    return sample;
  });
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const y = (value: number) => 148 - ((value - min) / range) * 118;
  const points = values.map((value, index) => `${20 + (index / (values.length - 1)) * 760},${y(value)}`).join(" ");
  const zeroY = y(0);
  const positive = values.map((value, index) => `${20 + (index / (values.length - 1)) * 760},${y(Math.max(value, 0))}`).join(" ");
  const negative = values.map((value, index) => `${20 + (index / (values.length - 1)) * 760},${y(Math.min(value, 0))}`).join(" ");

  return (
    <svg className="td-area-chart" viewBox="0 0 800 180" preserveAspectRatio="none" role="img" aria-label="Market breadth distribution from observed 24 hour asset changes">
      <defs>
        <linearGradient id="td-positive-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#31d995" stopOpacity=".34" /><stop offset="100%" stopColor="#31d995" stopOpacity=".015" /></linearGradient>
        <linearGradient id="td-negative-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f05d67" stopOpacity=".02" /><stop offset="100%" stopColor="#f05d67" stopOpacity=".28" /></linearGradient>
      </defs>
      <line x1="20" x2="780" y1={zeroY} y2={zeroY} className="td-grid-line" />
      <polygon points={`20,${zeroY} ${positive} 780,${zeroY}`} fill="url(#td-positive-fill)" />
      <polygon points={`20,${zeroY} ${negative} 780,${zeroY}`} fill="url(#td-negative-fill)" />
      <polyline points={points} fill="none" stroke="#52cfd0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {values.map((value, index) => <circle key={index} cx={20 + (index / (values.length - 1)) * 760} cy={y(value)} r="2" fill={value >= 0 ? "#42d99b" : "#f06770"}><title>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</title></circle>)}
      <text x="26" y="18" className="td-chart-note">24H CHANGE DISTRIBUTION · OBSERVED ASSETS</text>
    </svg>
  );
}

function ScatterChart({ assets }: { assets: TerminalAsset[] }) {
  const points = assets.filter((asset) => Number.isFinite(asset.price_change_percentage_24h) && Number.isFinite(asset.price_change_percentage_7d_in_currency));
  if (points.length < 2) return <div className="td-empty">Not enough market data points.</div>;
  const max = Math.max(2, ...points.flatMap((asset) => [
    Math.abs(asset.price_change_percentage_24h ?? 0),
    Math.abs(asset.price_change_percentage_7d_in_currency ?? 0),
  ]));
  const x = (value: number) => 35 + ((value + max) / (max * 2)) * 310;
  const y = (value: number) => 155 - ((value + max) / (max * 2)) * 120;
  return (
    <svg className="td-scatter-chart" viewBox="0 0 380 180" preserveAspectRatio="none" role="img" aria-label="Scatter plot comparing 24 hour and 7 day asset change">
      <line x1="35" x2="345" y1="95" y2="95" className="td-grid-line" />
      <line x1="190" x2="190" y1="24" y2="155" className="td-grid-line" />
      <text x="34" y="172" className="td-chart-note">24H</text>
      <text x="9" y="19" className="td-chart-note">7D</text>
      {points.map((asset, index) => {
        const xValue = asset.price_change_percentage_24h ?? 0;
        const yValue = asset.price_change_percentage_7d_in_currency ?? 0;
        const color = xValue >= 0 && yValue >= 0 ? "#38d89a" : xValue < 0 && yValue < 0 ? "#ef6069" : "#44bdeb";
        return <circle key={asset.id} cx={x(xValue)} cy={y(yValue)} r={index < 3 ? 5 : 3.5} fill={color} fillOpacity=".86"><title>{asset.name}: 24h {formatChange(xValue)} · 7d {formatChange(yValue)}</title></circle>;
      })}
    </svg>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="td-loading" role="status"><span className="td-spinner" />{label}</div>;
}

export default function TerminalDashboard({
  assets,
  loading,
  error,
  updatedAt,
  selectedId,
  onSelectAsset,
  onRefresh,
  economicFeed,
}: {
  assets: TerminalAsset[];
  loading: boolean;
  error: string;
  updatedAt: Date | null;
  selectedId: string;
  onSelectAsset: (id: string) => void;
  onRefresh: () => void;
  economicFeed: ReturnType<typeof useEconomicFeeds>;
}) {
  const [range, setRange] = useState<TerminalRange>("7");
  const [candleResponse, setCandleResponse] = useState<{ key: string; candles: TerminalCandle[]; error: string } | null>(null);
  const orbitStories = useMemo(() => buildOrbitStories(economicFeed.macro, economicFeed.news?.headlines ?? [], economicFeed.errors), [economicFeed.macro, economicFeed.news, economicFeed.errors]);
  const tiltedPanel = useRef<HTMLElement | null>(null);
  function resetPanel() {
    tiltedPanel.current?.style.removeProperty("--panel-rx");
    tiltedPanel.current?.style.removeProperty("--panel-ry");
    tiltedPanel.current = null;
  }
  function tiltPanel(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const panel = event.target instanceof Element ? event.target.closest<HTMLElement>(".td-panel") : null;
    if (tiltedPanel.current !== panel) resetPanel();
    if (!panel) return;
    tiltedPanel.current = panel;
    const rect = panel.getBoundingClientRect();
    const x = Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
    const y = Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)));
    panel.style.setProperty("--panel-rx",`${(0.5-y)*2}deg`);
    panel.style.setProperty("--panel-ry",`${(x-0.5)*2}deg`);
    panel.style.setProperty("--shine-x",`${x*100}%`);
    panel.style.setProperty("--shine-y",`${y*100}%`);
  }
  const [chartRequest, setChartRequest] = useState(0);
  const [commodityResponse, setCommodityResponse] = useState<{
    quotes: CommodityQuote[];
    unavailable: string[];
    checkedAt: number;
    error: string;
  }>({ quotes: [], unavailable: [], checkedAt: 0, error: "" });
  const [commodityRequest, setCommodityRequest] = useState(0);
  const [chartCommodityId, setChartCommodityId] = useState<CommodityQuote["id"] | "">("");
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const chartCommodity = commodityResponse.quotes.find((quote) => quote.id === chartCommodityId);
  function openCommodityChart(id: CommodityQuote["id"]) {
    setChartCommodityId(id);
    if (range === "1") setRange("7");
    window.requestAnimationFrame(() => {
      const chart = document.getElementById("terminal-price-chart");
      chart?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
      chart?.focus({ preventScroll: true });
    });
  }
  const orderedMovers = useMemo(
    () => [...assets].sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)),
    [assets],
  );
  const marketCap = assets.reduce((sum, asset) => sum + (Number.isFinite(asset.market_cap) ? asset.market_cap : 0), 0);
  const upCount = assets.filter((asset) => (asset.price_change_percentage_24h ?? 0) > 0).length;
  const book = selected ? createDemoOrderBook(selected.current_price) : null;
  const selectedAssetId = selected?.id ?? "";
  const chartRequestKey = `${selectedAssetId}:${range}:${chartRequest}:${updatedAt?.getTime()??0}`;
  const candleLoading = Boolean(selectedAssetId) && candleResponse?.key !== chartRequestKey;
  const candleError = candleResponse?.key === chartRequestKey ? candleResponse.error : "";
  const candles = candleResponse?.key === chartRequestKey ? candleResponse.candles : [];

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const loadCommodities = async () => {
      try {
        const result = await fetchCommodityQuotes(controller.signal);
        if (active) {
          setCommodityResponse({
            quotes: result.quotes,
            unavailable: result.unavailable,
            checkedAt: result.checkedAt,
            error: "",
          });
        }
      } catch (reason) {
        if (active && !controller.signal.aborted) {
          setCommodityResponse((current) => ({
            ...current,
            error: reason instanceof Error ? reason.message : "Gold, silver and oil reference quotes could not be loaded.",
          }));
        }
      }
    };

    void loadCommodities();
    const interval = window.setInterval(() => void loadCommodities(), 5 * 60 * 1000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [commodityRequest]);

  useEffect(() => {
    if (!selectedAssetId || chartCommodityId) return;

    const controller = new AbortController();
    fetchTerminalCandles(selectedAssetId, range, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCandleResponse({ key: chartRequestKey, candles: result, error: "" });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setCandleResponse({
            key: chartRequestKey,
            candles: [],
            error: reason instanceof Error ? reason.message : "Market candles could not be loaded.",
          });
        }
      });

    return () => controller.abort();
  }, [selectedAssetId, range, chartRequest, chartRequestKey, chartCommodityId]);

  const connectionText = error ? "FEED DEGRADED" : loading && !assets.length ? "CONNECTING" : "REFERENCE FEED";

  return (
    <section className="terminal-dashboard" aria-label="Market overview terminal" onPointerMove={tiltPanel} onPointerLeave={resetPanel}>
      <header className="td-overview-heading">
        <h1>ទិដ្ឋភាពទូទៅ</h1>
        <span className={`td-overview-source ${error ? "is-error" : ""}`}><i aria-hidden="true" />{connectionText}<span>CoinGecko / USD</span></span>
      </header>

      {error && <div className="td-feed-error" role="alert">{error}<ControlButton onClick={onRefresh}>RETRY</ControlButton></div>}

      <section className="td-kpi-grid" aria-label="Market summary">
        <article className="td-panel td-kpi td-kpi-main"><span className="glass-kpi-icon" aria-hidden="true">◈</span><span className="td-label">TRACKED MARKET CAP <i>USD</i></span><strong>{assets.length ? formatCompactUsd(marketCap) : "—"}</strong><small><b className="td-accent-cyan">●</b> Combined capitalization · top {assets.length || 12}</small><Sparkline values={assets[0]?.sparkline_in_7d?.price ?? []} positive={(assets[0]?.price_change_percentage_24h ?? 0) >= 0} /></article>
        <article className="td-panel td-kpi"><span className="glass-kpi-icon" aria-hidden="true">◔</span><span className="td-label">MARKET BREADTH <i>24H</i></span><strong>{assets.length ? <>{upCount}<small> / {assets.length}</small></> : "—"}</strong><small><b className="td-accent-green">●</b> Assets advancing</small><div className="td-breadth-track"><i style={{ width: `${assets.length ? (upCount / assets.length) * 100 : 0}%` }} /></div></article>
        <article className="td-panel td-kpi"><span className="glass-kpi-icon" aria-hidden="true">↗</span><span className="td-label">LEADING ASSET <i>24H</i></span><strong className={(orderedMovers[0]?.price_change_percentage_24h ?? 0) >= 0 ? "td-green-text" : "td-red-text"}>{assets.length ? formatChange(orderedMovers[0]?.price_change_percentage_24h ?? null) : "—"}</strong><small>{orderedMovers[0]?.symbol.toUpperCase() ?? "Awaiting market feed"} · price change</small><Sparkline values={orderedMovers[0]?.sparkline_in_7d?.price ?? []} positive={(orderedMovers[0]?.price_change_percentage_24h ?? 0) >= 0} /></article>
        <article className="td-panel td-kpi"><span className="glass-kpi-icon" aria-hidden="true">◷</span><span className="td-label">DATA AS OF <i>REFERENCE</i></span><strong className="td-kpi-time">{updatedAt ? updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—"}</strong><small>{updatedAt ? updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Waiting for first response"}</small><span className="td-source-mark">COINGECKO · 60S REFRESH</span></article>
      </section>

      <section className="td-commodities-panel td-panel" id="commodities" aria-label="Gold, silver and oil markets">
        <div className="td-commodities-heading">
          <div><span className="td-label">COMMODITIES / FUTURES REFERENCE</span><h2>Gold, silver &amp; oil / Commodities</h2></div>
          <div className="td-commodities-source">
            <span>YAHOO FINANCE · MAY BE DELAYED</span>
            <ControlButton type="button" onClick={() => setCommodityRequest((request) => request + 1)} aria-label="Refresh gold, silver and oil quotes">↻ REFRESH</ControlButton>
          </div>
        </div>
        {commodityResponse.error && !commodityResponse.quotes.length ? (
          <div className="td-commodity-state" role="status">{commodityResponse.error}<ControlButton type="button" onClick={() => setCommodityRequest((request) => request + 1)}>RETRY</ControlButton></div>
        ) : (
          <div className="td-commodity-grid">
            {([
              { id: "gold", name: "Gold futures", ticker: "GC=F", descriptor: "TROY OUNCE" },
              { id: "silver", name: "Silver futures", ticker: "SI=F", descriptor: "TROY OUNCE" },
              { id: "wti", name: "WTI crude oil", ticker: "CL=F", descriptor: "US BARREL" },
              { id: "brent", name: "Brent crude oil", ticker: "BZ=F", descriptor: "BARREL" },
            ] as const).map((instrument) => {
              const quote = commodityResponse.quotes.find((item) => item.id === instrument.id);
              const unavailable = commodityResponse.unavailable.includes(instrument.id);
              const isPositive = (quote?.changePercent ?? 0) >= 0;
              return (
                <article className={`td-commodity-card ${!quote ? "is-unavailable" : ""}`} key={instrument.id}>
                  <div className="td-commodity-name">
                    <span className={`td-commodity-icon td-commodity-${instrument.id}`}>{instrument.id === "gold" ? "Au" : instrument.id === "silver" ? "Ag" : "OIL"}</span>
                    <span><b>{instrument.name}</b><small>{instrument.ticker} · {instrument.descriptor}</small></span>
                  </div>
                  {quote ? (
                    <>
                      <ControlButton variant="row" type="button" className="td-commodity-select" onClick={() => openCommodityChart(quote.id)} aria-label={`View ${quote.name} chart`} aria-pressed={chartCommodityId === quote.id}><strong className="td-commodity-price">{formatTerminalPrice(quote.price)}</strong><small>VIEW CHART</small></ControlButton>
                      <div className="td-commodity-foot">
                        <Sparkline values={quote.history.map((point) => point.price)} positive={isPositive} />
                        <span className={isPositive ? "td-green-text" : "td-red-text"}>{formatChange(quote.changePercent)} <small>1D</small></span>
                        <small>{new Date(quote.asOf).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</small>
                      </div>
                    </>
                  ) : <div className="td-commodity-unavailable">{unavailable ? "Quote temporarily unavailable" : "Loading market reference…"}</div>}
                </article>
              );
            })}
          </div>
        )}
        {commodityResponse.error && commodityResponse.quotes.length > 0 && <p className="td-commodity-warning" role="status">{commodityResponse.error} · Showing last available quotes.</p>}
        <p className="td-commodity-disclaimer">Futures reference prices in USD; daily change is based on the provider’s previous close. Quotes may be delayed and are not executable broker prices.</p>
      </section>

      <ForexSummary />

      <section className="td-upper-grid" aria-label="Market instruments">
        <article className="td-panel td-price-panel" id="terminal-price-chart" tabIndex={-1}>
          <div className="td-panel-heading">
            <div><span className="td-label">{chartCommodity ? "COMMODITY REFERENCE / DAILY HISTORY" : "PRICE ACTION / OHLC"}</span><h2>{chartCommodity ? `${chartCommodity.name} · ${chartCommodity.unit}` : selected ? `${selected.name} / USD` : "Market candles"}</h2></div>
            <div className="td-chart-controls">
              <select aria-label="Select chart market" value={chartCommodity ? `commodity:${chartCommodity.id}` : selected ? `crypto:${selected.id}` : ""} onChange={(event) => {
                if (event.target.value.startsWith("commodity:")) {
                  setChartCommodityId(event.target.value.slice("commodity:".length) as CommodityQuote["id"]);
                  if (range === "1") setRange("7");
                } else {
                  setChartCommodityId("");
                  onSelectAsset(event.target.value.slice("crypto:".length));
                }
              }} disabled={!assets.length && !commodityResponse.quotes.length}>
                <optgroup label="Crypto · CoinGecko">{assets.map((asset) => <option value={`crypto:${asset.id}`} key={asset.id}>{asset.symbol.toUpperCase()}</option>)}</optgroup>
                <optgroup label="Futures · Reference">{commodityResponse.quotes.map((quote) => <option value={`commodity:${quote.id}`} key={quote.id}>{quote.symbol}</option>)}</optgroup>
              </select>
              <div className="td-range-controls" role="group" aria-label="Candlestick time range">
                {(chartCommodity ? ["7", "30"] as TerminalRange[] : ["1", "7", "30"] as TerminalRange[]).map((value) => <ControlButton key={value} className={range === value ? "is-active" : ""} aria-pressed={range === value} onClick={() => setRange(value)}>{value === "1" ? "1D" : `${value}D`}</ControlButton>)}
              </div>
            </div>
          </div>
          <div className="td-price-readout"><strong>{chartCommodity ? formatTerminalPrice(chartCommodity.price) : selected ? formatTerminalPrice(selected.current_price) : "—"}</strong><span className={(chartCommodity ? chartCommodity.changePercent : selected?.price_change_percentage_24h ?? 0) >= 0 ? "td-green-text" : "td-red-text"}>{formatChange(chartCommodity ? chartCommodity.changePercent : selected?.price_change_percentage_24h ?? null)} <i>{chartCommodity ? "1D REF" : "24H"}</i></span></div>
          <div className="td-price-chart-wrap">{chartCommodity ? <CommoditySeriesChart quote={chartCommodity} range={range} /> : !selected ? <div className="td-empty">Waiting for market assets.</div> : candleLoading ? <LoadingPanel label="Loading market OHLC…" /> : candleError ? <div className="td-chart-error" role="status">{candleError}<ControlButton onClick={() => setChartRequest((request) => request + 1)}>RETRY</ControlButton></div> : <PriceChart key={chartRequestKey} candles={candles} />}</div>
          <footer className="td-panel-foot"><span>{chartCommodity ? "DAILY FUTURES REFERENCE" : <><i className="td-legend-up" /> UP <i className="td-legend-down" /> DOWN</>}</span><span>{chartCommodity ? `${chartCommodity.history.length} daily points · Yahoo Finance` : candles.length ? `${candles.length} candles · CoinGecko` : "No local candle cache"}</span></footer>
        </article>

        <article className="td-panel td-book-panel">
          <div className="td-panel-heading"><div><span className="td-label">DEPTH SNAPSHOT</span><h2>Illustrative book</h2></div><span className="td-demo-badge">DEMO / SIMULATED DATA</span></div>
          <div className="td-book-columns"><span>PRICE · USD</span><span>SIZE</span><span>CUM.</span></div>
          <div className="td-book-levels td-asks">{book?.asks.map((level) => <div key={level.price}><i style={{ width: `${Math.min(100, level.total / 2.8 * 100)}%` }} /><b>{formatTerminalPrice(level.price)}</b><span>{level.size.toFixed(3)}</span><span>{level.total.toFixed(3)}</span></div>) ?? <div className="td-empty">Market price unavailable.</div>}</div>
          <div className="td-book-mid"><strong>{selected ? formatTerminalPrice(selected.current_price) : "—"}</strong><span>REFERENCE MID · NOT EXCHANGE DEPTH</span></div>
          <div className="td-book-levels td-bids">{book?.bids.map((level) => <div key={level.price}><i style={{ width: `${Math.min(100, level.total / 2.8 * 100)}%` }} /><b>{formatTerminalPrice(level.price)}</b><span>{level.size.toFixed(3)}</span><span>{level.total.toFixed(3)}</span></div>) ?? <div className="td-empty">Market price unavailable.</div>}</div>
          <p className="td-disclaimer">Illustrative levels only. No live order book or trade execution is connected.</p>
        </article>

        <article className="td-panel td-movers-panel">
          <div className="td-panel-heading"><div><span className="td-label">OBSERVED MARKET MOVES</span><h2>Recent movers</h2></div><Link href="/markets/assets">ALL ASSETS ↗</Link></div>
          {loading && !assets.length ? <LoadingPanel label="Loading market movers…" /> : assets.length ? (
            <div className="td-mover-list">
              {orderedMovers.slice(0, 6).map((asset) => {
                const change = asset.price_change_percentage_24h ?? 0;
                return <ControlButton variant="row" className={`td-mover-row ${!chartCommodityId && selected?.id === asset.id ? "is-selected" : ""}`} key={asset.id} onClick={() => { setChartCommodityId(""); onSelectAsset(asset.id); }} title={`View ${asset.name} chart`}>
                  <Image src={asset.image} alt="" width={17} height={17} unoptimized /><span className="td-mover-name"><b>{asset.symbol.toUpperCase()}</b><small>{asset.name}</small></span><Sparkline values={asset.sparkline_in_7d?.price ?? []} positive={change >= 0} /><strong className={change >= 0 ? "td-green-text" : "td-red-text"}>{formatChange(change)}</strong>
                </ControlButton>;
              })}
            </div>
          ) : <div className="td-empty">No market assets are available yet.</div>}
          <p className="td-disclaimer">Observed price changes from the CoinGecko reference feed · not trade activity.</p>
        </article>
      </section>

      <section className="td-torus-panel td-panel" aria-label="Market flow visualization">
        <div className="td-torus-heading"><span className="td-label">WORLD MARKET / CPI & ECONOMIC NEWS</span><span className="td-live-indicator"><i /> GLOBE ANIMATION</span></div>
        <div className="td-torus-layout">
          <div className="td-torus-stage"><WorldGlobe stories={orbitStories} loading={economicFeed.loading} quotes={buildGalaxyQuotes(assets,commodityResponse.quotes,updatedAt?.getTime()??null,Boolean(error),Boolean(commodityResponse.error))} /><div className="td-torus-caption">GLOBAL MARKET CONTEXT <i>GLOBE IS DECORATIVE / DATA SOURCES BELOW</i></div></div>
          <aside className="td-torus-metrics">
            <div><span>MARKET CAP / TOP 12</span><strong>{assets.length ? formatCompactUsd(marketCap) : "—"}</strong><small>CoinGecko reference</small></div>
            <div><span>24H VOLUME / TOP 12</span><strong>{assets.length ? formatCompactUsd(assets.reduce((sum, asset) => sum + (asset.total_volume || 0), 0)) : "—"}</strong><small>Reported market volume</small></div>
            <div><span>ADVANCING ASSETS</span><strong className="td-green-text">{assets.length ? `${upCount} / ${assets.length}` : "—"}</strong><small>24 hour change &gt; 0%</small></div>
            <div><span>REFERENCE COVERAGE</span><strong>{assets.length ? `${Math.round((assets.length / 12) * 100)}%` : "—"}</strong><small>{assets.length} of 12 tracked assets</small></div>
            <Link href="/markets/analysis" className="td-text-link">OPEN MARKET ANALYSIS ↗</Link>
          </aside>
        </div>
        <MarketBriefing feed={economicFeed} />
      </section>

      <section className="td-lower-grid" aria-label="Market statistics and trend">
        <article className="td-panel td-breadth-panel">
          <div className="td-panel-heading"><div><span className="td-label">MARKET BREADTH / 24H</span><h2>Return distribution</h2></div><span className="td-chart-unit">CHANGE · %</span></div>
          <DistributionChart assets={assets} />
          <footer className="td-panel-foot"><span><i className="td-legend-up" /> ADVANCING</span><span><i className="td-legend-down" /> DECLINING</span><span>{assets.length} reference assets</span></footer>
        </article>
        <article className="td-panel td-correlation-panel">
          <div className="td-panel-heading"><div><span className="td-label">PERFORMANCE MAP / 7D × 24H</span><h2>Trend dispersion</h2></div><span className="td-chart-unit">REFERENCE DATA</span></div>
          <ScatterChart assets={assets} />
          <footer className="td-panel-foot"><span><i className="td-legend-up" /> POSITIVE</span><span><i className="td-legend-down" /> NEGATIVE</span><span>Hover a point for the asset</span></footer>
        </article>
        <article className="td-panel td-stats-panel">
          <div className="td-panel-heading"><div><span className="td-label">SESSION STATISTICS</span><h2>Market pulse</h2></div></div>
          <div className="td-stat-row"><span>Tracked capitalization</span><b>{assets.length ? formatCompactUsd(marketCap) : "—"}</b></div>
          <div className="td-stat-row"><span>Positive 24h change</span><b className="td-green-text">{assets.length ? `${upCount} assets` : "—"}</b></div>
          <div className="td-stat-row"><span>Negative 24h change</span><b className="td-red-text">{assets.length ? `${assets.length - upCount} assets` : "—"}</b></div>
          <div className="td-progress-label"><span>ADVANCE / DECLINE RATIO</span><b>{assets.length ? `${Math.round((upCount / assets.length) * 100)}%` : "—"}</b></div>
          <div className="td-progress-track"><i style={{ width: `${assets.length ? (upCount / assets.length) * 100 : 0}%` }} /></div>
          <p className="td-stat-note">Reference-market statistics only. No account equity, P&amp;L, or executed-trade data is connected.</p>
        </article>
      </section>

      <OverviewAnalytics key={updatedAt?.getTime()??0} assets={assets}/>
      <ReferenceAssetDetails assets={assets} onSelect={id=>{setChartCommodityId("");onSelectAsset(id);document.querySelector(".td-price-panel")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});}}/>
      <footer className="td-terminal-footer">
        <span>REFERENCE DATA · COINGECKO · USD</span>
        <span>{updatedAt ? `LAST RESPONSE ${updatedAt.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false })} UTC` : "AWAITING MARKET RESPONSE"}</span>
        <span>NOT A REAL-TIME BROKER FEED · NOT INVESTMENT ADVICE</span>
      </footer>
    </section>
  );
}
