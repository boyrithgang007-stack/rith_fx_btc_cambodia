"use client";

import SidebarIcon from "./SidebarIcon";
import ResearchWorkbench from "./ResearchWorkbench";
import CandleSignalDesk from "./CandleSignalDesk";
import ForexEaPanel from "./ForexEaPanel";

import ControlButton from "./ControlButton";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import StrategyPanel from "./StrategyPanel";
import MacroObservatory from "./MacroObservatory";
import MobileDock from "./MobileDock";
import Link from "next/link";
import Image from "next/image";
import AccountSettings from "./AccountSettings";
import type { AuthUser } from "./lib/auth";
import { useAppTheme } from "./ThemeControls";
import { toggleAppTheme } from "./theme-store";
import TerminalDashboard from "./TerminalDashboard";
import { validTerminalAssets } from "./terminal-data";
import MarketTicker from "./MarketTicker";
import MarketNewsTicker from "./MarketNewsTicker";
import { useEconomicFeeds } from "./MarketBriefing";

type Asset = {
  id: string; symbol: string; name: string; image: string; current_price: number;
  market_cap: number; total_volume: number; price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null; sparkline_in_7d: { price: number[] };
};
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Range = "1" | "7" | "30";
export type DashboardView = "overview" | "macro" | "charts" | "analysis" | "assets" | "watchlist" | "strategy" | "forex" | "settings";
const dashboardSections: { view: DashboardView; label: string; icon: string }[] = [
  { view: "overview", label: "ទិដ្ឋភាពទូទៅ", icon: "⌂" },
  { view: "macro", label: "CPI / Macro", icon: "◎" },
  { view: "charts", label: "ក្រាបទីផ្សារ", icon: "▥" },
  { view: "analysis", label: "វិភាគទីផ្សារ", icon: "⌁" },
  { view: "assets", label: "ទ្រព្យសកម្ម", icon: "◇" },
  { view: "watchlist", label: "បញ្ជីចូលចិត្ត", icon: "☆" },
  { view: "strategy", label: "វិភាគទិន្នន័យ", icon: "⌁" },
  { view: "forex", label: "Forex", icon: "⇄" },
];

type ForexPair = { symbol: string; base: string; currency: string; inverse: boolean; rate: number; previousRate: number | null; changePercent: number | null };
type ForexData = { source: string; asOf: string; previousDate: string | null; pairs: ForexPair[]; history: { date: string; rates: Record<string, number> }[] };



function subscribeLocalStorage(key: string, callback: () => void) {
  const handleChange = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== key) return;
    if (event instanceof CustomEvent && event.detail !== key) return;
    callback();
  };
  window.addEventListener("storage", handleChange);
  window.addEventListener("market-storage-change", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("market-storage-change", handleChange);
  };
}

function subscribeMarketCache(callback: () => void) { return subscribeLocalStorage("market-assets-cache", callback); }
function readMarketCache() { return window.localStorage.getItem("market-assets-cache") || ""; }
function subscribeFavorites(callback: () => void) { return subscribeLocalStorage("market-favorites", callback); }
const EMPTY_FAVORITES: string[] = [];
let favoritesSnapshotRaw: string | null = null;
let favoritesSnapshot: string[] = EMPTY_FAVORITES;
function subscribeSelectedAsset(callback: () => void) { return subscribeLocalStorage("market-selected-asset", callback); }
function readSelectedAsset() { return window.localStorage.getItem("market-selected-asset") || "bitcoin"; }
function subscribeForexPair(callback: () => void) { return subscribeLocalStorage("market-forex-pair", callback); }
function readForexPair() { return window.localStorage.getItem("market-forex-pair") || "EUR/USD"; }
function readFavorites() {
  const raw = window.localStorage.getItem("market-favorites") || "[]";
  if (raw === favoritesSnapshotRaw) return favoritesSnapshot;
  try {
    const value: unknown = JSON.parse(raw);
    favoritesSnapshot = Array.isArray(value) && value.every((id) => typeof id === "string") ? value as string[] : EMPTY_FAVORITES;
  } catch {
    favoritesSnapshot = EMPTY_FAVORITES;
  }
  favoritesSnapshotRaw = raw;
  return favoritesSnapshot;
}
function selectStoredValue(key: string, value: string) {
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent("market-storage-change", { detail: key }));
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const price = (value: number) => value >= 1 ? money.format(value) : `$${value.toPrecision(4)}`;
const percent = (value: number | null) => `${(value ?? 0) >= 0 ? "+" : ""}${(value ?? 0).toFixed(2)}%`;
const forexPrice = (value: number) => value >= 100 ? value.toFixed(3) : value.toFixed(5);
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (!values?.length) return <span className="spark-empty" />;
  const low = Math.min(...values);
  const spread = Math.max(...values) - low || 1;
  const points = values.map((value, index) => `${index / Math.max(values.length - 1, 1) * 100},${28 - (value - low) / spread * 25}`).join(" ");
  return <svg className={`sparkline ${positive ? "is-positive" : "is-negative"}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}

function CandlestickChart({ candles }: { candles: Candle[] }) {
  if (candles.length < 2) return <div className="chart-empty">មិនមានទិន្នន័យ candle គ្រប់គ្រាន់សម្រាប់បង្ហាញទេ។</div>;
  const low = Math.min(...candles.map((candle) => candle.low));
  const high = Math.max(...candles.map((candle) => candle.high));
  const spread = high - low || high * .01 || 1;
  const y = (value: number) => 274 - (value - low) / spread * 244;
  const step = 900 / candles.length;
  const bodyWidth = Math.max(2, Math.min(12, step * .66));
  const date = (time: number) => new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const latest = candles.at(-1)!;
  return <div className="chart-wrap">
    <svg className="price-chart candle-chart" viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="ក្រាប candlestick OHLC">
      {[0, 1, 2, 3, 4].map((index) => {
        const value = high - spread * index / 4;
        const lineY = 30 + index * 61;
        return <g key={index}><line x1="18" x2="940" y1={lineY} y2={lineY} className="chart-grid" /><text x="948" y={lineY + 3} className="candle-axis-label">{price(value)}</text></g>;
      })}
      {candles.map((candle, index) => {
        const center = 24 + step * (index + .5);
        const rising = candle.close >= candle.open;
        const top = y(Math.max(candle.open, candle.close));
        const bodyHeight = Math.max(1.4, Math.abs(y(candle.open) - y(candle.close)));
        const color = rising ? "#12805c" : "#d45158";
        return <g key={candle.time}>
          <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={Math.max(1, Math.min(2, bodyWidth * .22))} />
          <rect x={center - bodyWidth / 2} y={top} width={bodyWidth} height={bodyHeight} fill={rising ? color : "#fff"} stroke={color} strokeWidth="1.2">
            <title>{new Date(candle.time).toLocaleString("en-US")} · O {price(candle.open)} · H {price(candle.high)} · L {price(candle.low)} · C {price(candle.close)}</title>
          </rect>
        </g>;
      })}
    </svg>
    <div className="chart-axis"><span>{date(candles[0].time)}</span><span>{date(candles[Math.floor(candles.length / 2)].time)}</span><span>{date(latest.time)}</span></div>
    <span className="chart-start">ទាប {price(low)}</span><span className="chart-end">ខ្ពស់ {price(high)}</span>
    <span className="candle-latest">ចុងក្រោយ · O {price(latest.open)} · H {price(latest.high)} · L {price(latest.low)} · C {price(latest.close)}</span>
  </div>;
}

export default function MarketDashboard({ user, view = "overview" }: { user: AuthUser; view?: DashboardView }) {
  const router = useRouter();
  const economicFeed = useEconomicFeeds(view === "overview");
  const userEmail = user.email;
  const [profile, setProfile] = useState(user);
  const displayName = profile.displayName?.trim() || userEmail.split("@")[0];
  const [assets, setAssets] = useState<Asset[]>([]);
  const selectedId = useSyncExternalStore(subscribeSelectedAsset, readSelectedAsset, () => "bitcoin");
  const [range, setRange] = useState<Range>("7");
  const [chartData, setChartData] = useState<{ key: string; candles: Candle[] } | null>(null);
  const [query, setQuery] = useState("");
  const favorites = useSyncExternalStore(subscribeFavorites, readFavorites, () => EMPTY_FAVORITES);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartLoadedKey, setChartLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const theme = useAppTheme();
  const marketCache = useSyncExternalStore(subscribeMarketCache, readMarketCache, () => "");
  const [forexData, setForexData] = useState<ForexData | null>(null);
  const forexPairSymbol = useSyncExternalStore(subscribeForexPair, readForexPair, () => "EUR/USD");
  const [forexRange, setForexRange] = useState<7 | 30>(7);
  const [analysisMarket, setAnalysisMarket] = useState<"crypto" | "forex">("crypto");
  const [forexAmount, setForexAmount] = useState(1);
  const [forexLoading, setForexLoading] = useState(true);
  const [forexError, setForexError] = useState("");
  async function loadMarkets() {
    setLoading(true);
    try {
      const response = await fetch("/api/market", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "មិនអាចទាញទិន្នន័យទីផ្សារបានទេ។");
      if (!validTerminalAssets(result.assets)) throw new Error("Market data is incomplete. Please refresh.");
      setAssets(result.assets);
      const timestamp = new Date();
      setUpdatedAt(timestamp);
      window.localStorage.setItem("market-assets-cache", JSON.stringify({ assets: result.assets, updatedAt: timestamp.toISOString() }));
      window.dispatchEvent(new CustomEvent("market-storage-change", { detail: "market-assets-cache" }));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មានបញ្ហាក្នុងការភ្ជាប់ទិន្នន័យទីផ្សារ។");
    } finally {
      setLoading(false);
    }
  }

  async function loadForex() {
    try {
      const response = await fetch("/api/forex", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "មិនអាចទាញ Forex rates បានទេ។");
      setForexData(result as ForexData);
      setForexError("");
    } catch (reason) {
      setForexError(reason instanceof Error ? reason.message : "មិនអាចទាញ Forex rates បានទេ។");
    } finally {
      setForexLoading(false);
    }
  }

  useEffect(() => {
    if (view === "forex" || view === "analysis") return;
    const initialRequest = window.setTimeout(() => { void loadMarkets(); }, 0);
    const timer = window.setInterval(() => void loadMarkets(), 60_000);
    return () => {
      window.clearTimeout(initialRequest);
      window.clearInterval(timer);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "forex" && view !== "analysis" && view !== "strategy") return;
    const initialRequest = window.setTimeout(() => { void loadForex(); }, 0);
    const timer = window.setInterval(() => void loadForex(), 6 * 60 * 60 * 1000);
    return () => {
      window.clearTimeout(initialRequest);
      window.clearInterval(timer);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "charts") return;
    let cancelled = false;
    const requestKey = `${selectedId}:${range}`;
    fetch(`/api/market?candles=1&coin=${encodeURIComponent(selectedId)}&days=${range}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "មិនអាចទាញទិន្នន័យ candle បានទេ។");
        if (!Array.isArray(result.candles) || !result.candles.every((candle: Candle) => [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))) throw new Error("ទិន្នន័យ OHLC មិនត្រឹមត្រូវទេ។");
        if (!cancelled) {
          setChartData({ key: requestKey, candles: result.candles as Candle[] });
          setError("");
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "មិនអាចទាញទិន្នន័យ candle បានទេ។"); })
      .finally(() => { if (!cancelled) setChartLoadedKey(requestKey); });
    return () => { cancelled = true; };
  }, [selectedId, range, view]);

  const cachedMarket = useMemo(() => {
    try {
      const cached = marketCache ? JSON.parse(marketCache) : null;
      return cached && validTerminalAssets(cached.assets) && typeof cached.updatedAt === "string" && Number.isFinite(Date.parse(cached.updatedAt))
        ? cached as { assets: Asset[]; updatedAt: string } : null;
    }
    catch { return null; }
  }, [marketCache]);
  const marketAssets = useMemo(() => updatedAt ? assets : cachedMarket?.assets ?? [], [assets, cachedMarket, updatedAt]);
  const lastUpdatedAt = updatedAt ?? (cachedMarket?.updatedAt ? new Date(cachedMarket.updatedAt) : null);
  const selected = marketAssets.find((asset) => asset.id === selectedId) ?? marketAssets[0];
  const selectedForexPair = forexData?.pairs.find((pair) => pair.symbol === forexPairSymbol);
  const forexConvertedAmount = selectedForexPair ? forexAmount * selectedForexPair.rate : 0;
  const forexCutoff = forexData ? Date.parse(forexData.asOf) - forexRange * 86400000 : 0;
  const forexHistory = (forexData?.history ?? []).filter((point) => Date.parse(point.date) >= forexCutoff && Number.isFinite(point.rates[forexPairSymbol]));
  const forexStartRate = forexHistory[0]?.rates[forexPairSymbol];
  const forexEndRate = forexHistory.at(-1)?.rates[forexPairSymbol] ?? selectedForexPair?.rate;
  const forexRangeChange = forexStartRate && forexEndRate ? (forexEndRate - forexStartRate) / forexStartRate * 100 : null;
  const visibleAssets = useMemo(() => marketAssets.filter((asset) => `${asset.name} ${asset.symbol}`.toLowerCase().includes(query.toLowerCase()) && (!(favoritesOnly || view === "watchlist") || favorites.includes(asset.id))), [marketAssets, favorites, favoritesOnly, query, view]);
  const marketUp = (selected?.price_change_percentage_24h ?? 0) >= 0;
  const favorite = (id: string) => {
    const items = readFavorites();
    window.localStorage.setItem("market-favorites", JSON.stringify(items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
    window.dispatchEvent(new CustomEvent("market-storage-change", { detail: "market-favorites" }));
  };
  const chartKey = `${selectedId}:${range}`;
  const chartCandles = chartData?.key === chartKey ? chartData.candles : [];
  const chartLoading = chartLoadedKey !== chartKey;
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) router.refresh();
    else setError("មិនអាចចាកចេញបានទេ។ សូមសាកល្បងម្ដងទៀត។");
  }

  return <main className={`market-app theme-${theme}${view === "overview" ? " terminal-shell cinematic-terminal" : ""}`}>
    <aside className="dashboard-sidebar workspace-sidebar">
    <Link className="market-brand" href="/" aria-label="RFX Team, RITH FX BTC Cambodia Market Observatory home">
      <Image className="market-brand-logo" src="/brand/rfx-team-logo.png" alt="RFX Team" width={1376} height={768} sizes="(max-width: 760px) 104px, 210px" priority />
      <span className="market-brand-caption"><strong>RITH FX BTC</strong><small>CAMBODIA · MARKET OBSERVATORY</small></span>
    </Link>
      <p className="sidebar-label">ម៉ឺនុយ</p>
      <nav className="sidebar-nav" aria-label="ម៉ឺនុយមេ">
        <Link className="sidebar-link" href="/"><SidebarIcon name="home" /> ត្រឡប់ទៅទំព័រដើម</Link>
        <details className="sidebar-group" open={view !== "settings"}>
          <summary><span>ទីផ្សារ</span><i>{dashboardSections.length}</i><b aria-hidden="true">⌄</b></summary>
          <div className="sidebar-group-links">
            {dashboardSections.map((section) => <Link key={section.view} className={`sidebar-link ${view === section.view ? "selected" : ""}`} href={`/markets/${section.view}`} aria-current={view === section.view ? "page" : undefined}><SidebarIcon name={section.view} /> {section.label}{section.view === "watchlist" && favorites.length > 0 && <i>{favorites.length}</i>}</Link>)}
          </div>
        </details>
        <details className="sidebar-group">
          <summary><span>គណនី</span><i>4</i><b aria-hidden="true">⌄</b></summary>
          <div className="sidebar-group-links">
            <Link className="sidebar-link" href="/accounts/balances"><SidebarIcon name="account" /> សមតុល្យគណនី</Link>
            <Link className="sidebar-link" href="/accounts/exchanges"><SidebarIcon name="account" /> Exchange accounts</Link>
            <Link className="sidebar-link" href="/accounts/mt5"><SidebarIcon name="account" /> Forex account · MT5</Link>
            <Link className="sidebar-link" href="/accounts/bank"><SidebarIcon name="account" /> គណនីធនាគារ</Link>
          </div>
        </details>
        {user.role === "admin" && <Link className="sidebar-link" href="/admin/members"><SidebarIcon name="account" /> គ្រប់គ្រងសមាជិក</Link>}
        <Link className={`sidebar-link sidebar-settings-link ${view === "settings" ? "selected" : ""}`} href="/markets/settings" aria-current={view === "settings" ? "page" : undefined}><SidebarIcon name="settings" /> ការកំណត់</Link>
        <Link className="sidebar-link" href="/learn"><SidebarIcon name="learn" /> សិក្សាទីផ្សារ</Link>
      </nav>
      <div className="sidebar-bottom">
        <Link className="sidebar-profile" href="/markets/settings">
          <Image src={profile.avatarDataUrl || "/images/rith-profile.jpeg"} alt="" width={36} height={36} unoptimized />
          <span className="sidebar-profile-copy"><strong>{displayName}</strong><small>{userEmail}</small></span><span className="sidebar-profile-arrow">↗</span>
        </Link>
        <div className="sidebar-live"><span className="status-pulse" /><span>ទិន្នន័យយោង<small>{view === "forex" ? "Frankfurter · ECB" : "CoinGecko"}</small></span></div>
      </div>
    </aside>
    <div className="dashboard-workspace">
    {view === "overview" && <><div className="dashboard-market-strip"><MarketTicker/></div><MarketNewsTicker feed={economicFeed}/></>}
    <header className={`market-header${view === "overview" ? " market-header-overview" : ""}`}><div className="header-title"><span className="header-market-status"><span className="status-pulse" /> ទីផ្សារឌីជីថល</span><span className="header-divider" /><span className="header-usd">ទិន្នន័យ USD</span></div><div className="header-actions">{(view === "assets" || view === "watchlist") && <label className="search-box header-search"><span>⌕</span><input id="market-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ស្វែងរកកាក់…" aria-label="ស្វែងរកកាក់" /></label>}<Link className="support-button" href="/support">ជំនួយ Support</Link><ControlButton controlSize="icon" className="theme-toggle" onClick={toggleAppTheme} aria-label={theme === "dark" ? "ប្តូរទៅរបៀបភ្លឺ" : "ប្តូរទៅរបៀបងងឹត"} title={theme === "dark" ? "របៀបភ្លឺ" : "របៀបងងឹត"}>{theme === "dark" ? "☼" : "☾"}</ControlButton><ControlButton variant="danger" className="logout-button" onClick={() => void logout()} title="ចាកចេញ">ចាកចេញ</ControlButton>{view !== "settings" && view !== "macro" && view !== "analysis" && <ControlButton variant="primary" className="refresh-button" onClick={() => { if (view === "forex" || (view === "strategy" && analysisMarket === "forex")) { setForexLoading(true); void loadForex(); } else void loadMarkets(); }} disabled={view === "forex" || (view === "strategy" && analysisMarket === "forex") ? forexLoading : loading}><span className={(view === "forex" || (view === "strategy" && analysisMarket === "forex") ? forexLoading : loading) ? "spin" : ""}>↻</span> ធ្វើបច្ចុប្បន្នភាព</ControlButton>}</div></header>
    <div className={`market-content ${view === "overview" ? "terminal-content" : ""}`} id="top">
      {view !== "overview" && <section className="page-intro"><div><p className="eyebrow">{view === "forex" ? "FOREIGN EXCHANGE" : view === "macro" ? "MACROECONOMICS" : view === "strategy" ? "CRYPTO · FOREX DATA ANALYSIS" : view === "settings" ? "ACCOUNT · PREFERENCES" : "CRYPTOCURRENCY · USD"}</p><h1>{view === "settings" ? "ការកំណត់គណនី" : dashboardSections.find((section) => section.view === view)?.label}</h1><p className="intro-copy">សួស្តី {displayName}! {view === "settings" ? "កំណត់រូបរាង និងគ្រប់គ្រងព័ត៌មានគណនីរបស់អ្នក។" : "សូមស្វែងយល់ពីមុខងារនីមួយៗនៅក្នុងផ្នែកដាច់ដោយឡែក។"}</p></div><div className="updated-label"><span className="status-pulse" /> {lastUpdatedAt ? `បច្ចុប្បន្នភាព ${lastUpdatedAt.toLocaleTimeString("km-KH", { hour: "2-digit", minute: "2-digit" })}` : "កំពុងភ្ជាប់ទិន្នន័យ"}</div></section>}
      {view === "settings" && <AccountSettings user={profile} onProfileUpdated={setProfile} />}
      {error && view !== "overview" && view !== "settings" && view !== "macro" && view !== "analysis" && <div className="error-banner" role="status"><span>{error}</span><ControlButton onClick={() => void loadMarkets()}>ព្យាយាមម្តងទៀត</ControlButton></div>}
      {view === "macro" && <MacroObservatory quotes={marketAssets.map(asset => ({symbol: asset.symbol, price: asset.current_price}))} updatedAt={lastUpdatedAt?.toISOString() ?? null} />}
      {view === "overview" && <TerminalDashboard assets={marketAssets} loading={loading} error={error} updatedAt={lastUpdatedAt} selectedId={selectedId} onSelectAsset={(id) => selectStoredValue("market-selected-asset", id)} onRefresh={() => void loadMarkets()} economicFeed={economicFeed} />}
      {view === "strategy" && <div className="analysis-market-switch" role="group" aria-label="ជ្រើសរើសទីផ្សារសម្រាប់វិភាគ"><span>ប្រភេទទីផ្សារ</span><div><ControlButton type="button" className={analysisMarket === "crypto" ? "active" : ""} aria-pressed={analysisMarket === "crypto"} onClick={() => setAnalysisMarket("crypto")}>◈ Crypto</ControlButton><ControlButton type="button" className={analysisMarket === "forex" ? "active" : ""} aria-pressed={analysisMarket === "forex"} onClick={() => setAnalysisMarket("forex")}>⇄ Forex</ControlButton></div></div>}
      {(view === "charts" || (view === "strategy" && analysisMarket === "crypto")) && <div className="market-instrument-picker"><label htmlFor="market-instrument">កាក់សម្រាប់ក្រាប និងវិភាគ</label><select id="market-instrument" value={selectedId} onChange={(event) => selectStoredValue("market-selected-asset", event.target.value)}>{marketAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.symbol.toUpperCase()})</option>)}</select><span>ការជ្រើសរើសត្រូវបានចែករំលែករវាងក្រាប និងវិភាគទិន្នន័យ។</span></div>}
      {view === "analysis" && <><CandleSignalDesk /><ResearchWorkbench /></>}
      {view === "charts" && <section className="market-main-grid" id="analytics">
        <article className="panel chart-panel"><div className="panel-topline"><div><p className="eyebrow">ទិដ្ឋភាពទ្រព្យសកម្ម</p><div className="selected-asset">{selected && <><Image src={selected.image} alt="" width={28} height={28} unoptimized /><div><h2>{selected.name}</h2><span>{selected.symbol.toUpperCase()} <i>·</i> USD</span></div></>}</div></div><ControlButton aria-pressed={Boolean(selected && favorites.includes(selected.id))} controlSize="icon" className={`favorite-toggle ${selected && favorites.includes(selected.id) ? "favorited" : ""}`} onClick={() => selected && favorite(selected.id)} aria-label="ដាក់ក្នុងបញ្ជីចូលចិត្ត">{selected && favorites.includes(selected.id) ? "★" : "☆"}</ControlButton></div>
          <div className="chart-price-row"><strong>{selected ? price(selected.current_price) : "—"}</strong>{selected && <span className={`change-pill ${marketUp ? "positive" : "negative"}`}>{percent(selected.price_change_percentage_24h)} <small>24h</small></span>}</div>
          <div className="chart-toolbar"><div className="chart-legend"><span className="candle-legend-up" /> ឡើង <span className="candle-legend-down" /> ចុះ · OHLC</div><div className="range-switch" role="group" aria-label="រយៈពេលក្រាប">{([["1", "24 ម៉ោង"], ["7", "7 ថ្ងៃ"], ["30", "30 ថ្ងៃ"]] as [Range, string][]).map(([value, label]) => <ControlButton key={value} className={range === value ? "active" : ""} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</ControlButton>)}</div></div>
          <div className="chart-stage">{chartLoading ? <div className="chart-skeleton"><span /><span /><span /></div> : <CandlestickChart candles={chartCandles} />}</div><div className="chart-foot"><span>តម្លៃបច្ចុប្បន្ន</span><strong>{selected ? price(selected.current_price) : "—"}</strong><span>កម្រិតប្រែប្រួល 24h</span><strong className={marketUp ? "text-positive" : "text-negative"}>{selected ? percent(selected.price_change_percentage_24h) : "—"}</strong></div>
        </article>
        <aside className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">ស្ថិតិសំខាន់ៗ</p><h2>ទិន្នន័យទីផ្សារ</h2></div><span className="detail-icon">↗</span></div><div className="detail-symbol">{selected ? <><Image src={selected.image} alt="" width={25} height={25} unoptimized /><span>{selected.symbol.toUpperCase()}<small>{selected.name}</small></span></> : <span>កំពុងទាញទិន្នន័យ…</span>}</div><div className="detail-row"><span>មូលធនទីផ្សារ</span><strong>{selected ? compact.format(selected.market_cap) : "—"}</strong></div><div className="detail-row"><span>បរិមាណជួញដូរ 24h</span><strong>{selected ? compact.format(selected.total_volume) : "—"}</strong></div><div className="detail-row"><span>ប្រែប្រួល 7 ថ្ងៃ</span><strong className={(selected?.price_change_percentage_7d_in_currency ?? 0) >= 0 ? "text-positive" : "text-negative"}>{selected ? percent(selected.price_change_percentage_7d_in_currency) : "—"}</strong></div><div className="detail-note"><span className="note-mark">i</span><p>ទិន្នន័យសម្រាប់ព័ត៌មានប៉ុណ្ណោះ។ មិនមែនជាការណែនាំវិនិយោគទេ។</p></div></aside>
      </section>}
      {view === "strategy" && analysisMarket === "crypto" && <StrategyPanel key={selectedId} coin={selectedId} name={selected?.name ?? selectedId} />}
      {view === "strategy" && analysisMarket === "forex" && <><ForexEaPanel isAdmin={user.role === "admin"} /><section className="panel forex-panel" aria-label="វិភាគទិន្នន័យ Forex">
        <div className="forex-heading"><div><p className="eyebrow">FOREX · ECB REFERENCE DATA</p><h2>វិភាគទិន្នន័យ Forex</h2><p>ចលនាអត្រាយោងប្រចាំថ្ងៃសម្រាប់គូដែលបានជ្រើសរើស។ មិនមែនតម្លៃ broker real-time ឬសញ្ញាបញ្ជាទិញទេ។</p></div><div className="forex-heading-actions"><span>{forexData ? `As of ${forexData.asOf}` : forexLoading ? "កំពុងទាញទិន្នន័យ" : "មិនមានទិន្នន័យ"}</span><ControlButton className="watchlist-filter" onClick={() => { setForexLoading(true); void loadForex(); }} disabled={forexLoading}>↻ Refresh</ControlButton></div></div>
        {forexError && <div className="forex-error" role="alert">{forexError}</div>}
        <div className="forex-analysis-toolbar"><label>គូសម្រាប់វិភាគ<select value={forexPairSymbol} onChange={(event) => selectStoredValue("market-forex-pair", event.target.value)}>{forexData?.pairs.map((pair) => <option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}</select></label><div className="range-switch" role="group" aria-label="រយៈពេលវិភាគ Forex"><ControlButton className={forexRange === 7 ? "active" : ""} aria-pressed={forexRange === 7} onClick={() => setForexRange(7)}>7 ថ្ងៃ</ControlButton><ControlButton className={forexRange === 30 ? "active" : ""} aria-pressed={forexRange === 30} onClick={() => setForexRange(30)}>30 ថ្ងៃ</ControlButton></div></div>
        <div className="forex-analysis-panel"><div className="forex-analysis-summary"><p className="eyebrow">{forexPairSymbol} · REFERENCE HISTORY</p><strong>{forexEndRate ? forexPrice(forexEndRate) : "—"}</strong><span className={forexRangeChange === null ? "" : forexRangeChange >= 0 ? "text-positive" : "text-negative"}>{forexRangeChange === null ? "មិនមានទិន្នន័យប្រៀបធៀប" : `${percent(forexRangeChange)} · ${forexRange} ថ្ងៃ`}</span><small>{forexHistory.length} ចំណុចទិន្នន័យ · {forexData?.source ?? (forexLoading ? "កំពុងទាញទិន្នន័យ…" : "មិនមានទិន្នន័យ")}</small></div><ForexHistoryChart history={forexHistory} symbol={forexPairSymbol} /></div>
        <p className="forex-disclaimer">ទិន្នន័យ Frankfurter/ECB ត្រូវបានធ្វើបច្ចុប្បន្នភាពតាមថ្ងៃធ្វើការ និងអាចយឺតជាង broker quote។ សូមប្រើតម្លៃពី broker របស់អ្នកមុនពេលសម្រេចចិត្តជួញដូរ។</p>
      </section></>}
      {view === "forex" && <><ForexEaPanel isAdmin={user.role === "admin"} /><section className="panel forex-panel" id="forex">
        <div className="forex-heading"><div><p className="eyebrow">FOREIGN EXCHANGE · ECB REFERENCE</p><h2>Forex currency pairs</h2><p>អត្រាយោងប្រចាំថ្ងៃ (មិនមែន broker quote ឬតម្លៃ real-time)។</p></div><div className="forex-heading-actions"><span>{forexData ? `As of ${forexData.asOf}` : "កំពុងទាញទិន្នន័យ"}</span><ControlButton className="watchlist-filter" onClick={() => { setForexLoading(true); void loadForex(); }} disabled={forexLoading}>↻ Refresh</ControlButton></div></div>
        {forexError && <div className="forex-error" role="status">{forexError}</div>}
        <div className="forex-analysis-toolbar"><label>គូសម្រាប់តាមដាន<select value={forexPairSymbol} onChange={(event) => selectStoredValue("market-forex-pair", event.target.value)}>{forexData?.pairs.map((pair) => <option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}</select></label><div className="range-switch" role="group" aria-label="រយៈពេលវិភាគ Forex"><ControlButton className={forexRange === 7 ? "active" : ""} onClick={() => setForexRange(7)}>7 ថ្ងៃ</ControlButton><ControlButton className={forexRange === 30 ? "active" : ""} onClick={() => setForexRange(30)}>30 ថ្ងៃ</ControlButton></div></div>
        <div className="forex-analysis-panel"><div className="forex-analysis-summary"><p className="eyebrow">{forexPairSymbol} · REFERENCE HISTORY</p><strong>{forexEndRate ? forexPrice(forexEndRate) : "—"}</strong><span className={forexRangeChange === null ? "" : forexRangeChange >= 0 ? "text-positive" : "text-negative"}>{forexRangeChange === null ? "មិនមានទិន្នន័យប្រៀបធៀប" : `${percent(forexRangeChange)} · ${forexRange} ថ្ងៃ`}</span><small>{forexHistory.length} ចំណុចទិន្នន័យ · {forexData?.source ?? "កំពុងទាញទិន្នន័យ"}</small></div><ForexHistoryChart history={forexHistory} symbol={forexPairSymbol} /></div>
        <div className="forex-layout">
          <div className="forex-table-scroll"><table className="forex-table"><thead><tr><th>គូរូបិយប័ណ្ណ</th><th>Reference rate</th><th>ប្រែប្រួលពីថ្ងៃមុន</th></tr></thead><tbody>{forexLoading && !forexData ? <tr><td colSpan={3} className="forex-empty">កំពុងទាញ Forex rates…</td></tr> : forexData?.pairs.map((pair) => <tr key={pair.symbol} className={pair.symbol === forexPairSymbol ? "fx-selected" : ""} tabIndex={0} onClick={() => selectStoredValue("market-forex-pair", pair.symbol)} onKeyDown={(event) => { if (event.key === "Enter") selectStoredValue("market-forex-pair", pair.symbol); }}><td><strong>{pair.symbol}</strong><small>{pair.base} / {pair.symbol.split("/")[1]}</small></td><td className="fx-rate">{forexPrice(pair.rate)}</td><td className={(pair.changePercent ?? 0) >= 0 ? "text-positive" : "text-negative"}>{pair.changePercent === null ? "—" : percent(pair.changePercent)}</td></tr>)}</tbody></table></div>
          <aside className="forex-converter"><p className="eyebrow">PAIR CONVERTER</p><label>គូ Forex<select value={forexPairSymbol} onChange={(event) => selectStoredValue("market-forex-pair", event.target.value)}>{forexData?.pairs.map((pair) => <option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}</select></label><h3>{selectedForexPair?.symbol ?? "ជ្រើសរើសគូ"}</h3><label>ចំនួន {selectedForexPair?.base ?? "base"}<input type="number" min="0" step="any" value={forexAmount} onChange={(event) => setForexAmount(Math.max(0, Number(event.target.value) || 0))} /></label><div className="fx-conversion-result"><span>{forexAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })} {selectedForexPair?.base}</span><b>=</b><strong>{forexConvertedAmount.toLocaleString("en-US", { maximumFractionDigits: 5 })} {selectedForexPair?.symbol.split("/")[1]}</strong></div><p className="fx-source-note">{forexData ? `ថ្ងៃមុន: ${forexData.previousDate ?? "—"} · ${forexData.source}` : "European Central Bank reference data"}</p></aside>
        </div>
        <div className="forex-disclaimer">ECB reference rates ត្រូវបានធ្វើបច្ចុប្បន្នភាពតាមថ្ងៃធ្វើការ និងអាចយឺតជាង broker quotes។ មិនមែនជា real-time trading price និងមិនរួមមាន spread/fees ទេ។</div>
      </section></>}
      {(view === "assets" || view === "watchlist") && <section className="panel assets-panel" id="assets"><div className="assets-heading"><div><p className="eyebrow">តាមដានចលនាទីផ្សារ</p><h2>{view === "watchlist" ? "បញ្ជីចូលចិត្ត" : "បញ្ជីទ្រព្យសកម្ម"}</h2></div><div className="table-tools">{view === "watchlist" ? <Link className="watchlist-filter active" href="/markets/assets">មើលទ្រព្យសកម្មទាំងអស់ ↗</Link> : <ControlButton aria-pressed={favoritesOnly} className={`watchlist-filter ${favoritesOnly ? "active" : ""}`} onClick={() => setFavoritesOnly((value) => !value)}>☆ ចូលចិត្ត{favorites.length ? ` · ${favorites.length}` : "ទាំងអស់"}</ControlButton>}</div></div>
        <div className="table-scroll"><table><thead><tr><th>#</th><th>ទ្រព្យសកម្ម</th><th>តម្លៃ</th><th>24 ម៉ោង</th><th>7 ថ្ងៃ</th><th>មូលធនទីផ្សារ</th><th>និន្នាការ 7 ថ្ងៃ</th><th>ចូលចិត្ត</th></tr></thead><tbody>{loading && !assets.length ? Array.from({ length: 5 }, (_, index) => <tr className="skeleton-row" key={index}><td colSpan={8}><span /></td></tr>) : visibleAssets.map((asset, index) => <tr key={asset.id} className={asset.id === selected?.id ? "selected-row" : ""} onClick={() => selectStoredValue("market-selected-asset", asset.id)}><td className="rank-cell">{String(index + 1).padStart(2, "0")}</td><td><div className="coin-cell"><Image src={asset.image} alt="" width={24} height={24} unoptimized /><span><strong>{asset.name}</strong><small>{asset.symbol.toUpperCase()}</small></span></div></td><td className="price-cell">{price(asset.current_price)}</td><td><span className={`table-change ${(asset.price_change_percentage_24h ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>{percent(asset.price_change_percentage_24h)}</span></td><td><span className={`table-change ${(asset.price_change_percentage_7d_in_currency ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>{percent(asset.price_change_percentage_7d_in_currency)}</span></td><td>{compact.format(asset.market_cap)}</td><td className="spark-cell"><Sparkline values={asset.sparkline_in_7d?.price ?? []} positive={(asset.price_change_percentage_7d_in_currency ?? 0) >= 0} /></td><td><ControlButton aria-pressed={favorites.includes(asset.id)} controlSize="icon" className={`table-star ${favorites.includes(asset.id) ? "favorited" : ""}`} aria-label={`ប្តូរបញ្ជីចូលចិត្ត ${asset.name}`} onClick={(event) => { event.stopPropagation(); favorite(asset.id); }}>{favorites.includes(asset.id) ? "★" : "☆"}</ControlButton></td></tr>)}{!loading && !visibleAssets.length && <tr><td className="empty-results" colSpan={8}>មិនមានទ្រព្យសកម្មដែលត្រូវនឹងការស្វែងរកទេ។</td></tr>}</tbody></table></div>
        <div className="table-footer"><span>បង្ហាញ {visibleAssets.length} ក្នុងចំណោម {assets.length} ទ្រព្យសកម្ម</span><span>បច្ចុប្បន្នភាពរៀងរាល់ 60 វិនាទី · USD</span></div>
      </section>}
      <footer className="market-footer"><span>ទីផ្សារហិរញ្ញវត្ថុ</span><span>ទិន្នន័យដោយ CoinGecko · អាចមានការពន្យារពេល</span></footer>
    </div>
    </div>
    <MobileDock />
  </main>;
}

function ForexHistoryChart({ history, symbol }: { history: { date: string; rates: Record<string, number> }[]; symbol: string }) {
  if (history.length < 2) return <div className="chart-empty">មិនមានប្រវត្តិទិន្នន័យគ្រប់គ្រាន់សម្រាប់គូ {symbol} ទេ។</div>;
  const values = history.map((point) => point.rates[symbol]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || high * .001 || 1;
  const line = values.map((value, index) => `${index / (values.length - 1) * 1000},${270 - (value - low) / spread * 230}`).join(" ");
  return <div className="forex-history-chart">
    <svg viewBox="0 0 1000 300" role="img" aria-label={`${symbol} ${history.length}-point daily reference-rate history`}>
      {[60, 120, 180, 240].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} className="chart-grid" />)}
      <polyline points={line} fill="none" className="chart-line is-positive" />
      <circle cx="1000" cy={270 - (values.at(-1)! - low) / spread * 230} r="5" className="chart-point is-positive" />
    </svg>
    <div className="forex-history-axis"><span>{history[0].date}</span><span>{forexPrice(low)}</span><span>{history.at(-1)!.date}</span><span>{forexPrice(high)}</span></div>
  </div>;
}
