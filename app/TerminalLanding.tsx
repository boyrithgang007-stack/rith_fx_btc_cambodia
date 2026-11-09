"use client";

import Image from "next/image";
import Link from "next/link";
import TerminalTorus from "./TerminalTorus";

export default function TerminalLanding() {
  return <main className="terminal-entry terminal-dashboard">
    <header className="td-terminal-header">
      <Link className="td-header-brand" href="/"><span className="td-brand-mark">RFX</span><span><b>RFX BTC TEAM</b><small>CAMBODIA / MARKET TERMINAL</small></span></Link>
      <span className="terminal-entry-status">PRIVATE WORKSPACE · SIGN IN REQUIRED</span>
      <Link className="terminal-open" href="/dashboard">ចូលប្រើ Dashboard ↗</Link>
      <Image className="terminal-entry-avatar" src="/images/rith-profile.jpeg" width={36} height={36} alt="RITH profile" />
    </header>
    <nav className="terminal-nav" aria-label="Market navigation"><Link href="/dashboard">OVERVIEW</Link><Link href="/markets/charts">CHARTS</Link><Link href="/markets/forex">FOREX</Link><Link href="/markets/assets">CRYPTO</Link><Link href="/dashboard#commodities">METALS &amp; ENERGY</Link><Link href="/markets/analysis">ANALYSIS</Link></nav>
    <section className="terminal-entry-heading"><div><p className="td-label">MULTI-ASSET RESEARCH / CAMBODIA</p><h1>ទីផ្សារទាំងមូល។<br /><span>ក្នុងផ្ទាំងតែមួយ។</span></h1></div><p>តាមដាន Forex, Crypto, មាស ប្រាក់ និងប្រេង។ ចូលគណនីដើម្បីមើលតម្លៃយោង ក្រាប និងឧបករណ៍វិភាគ។</p></section>
    <section className="terminal-entry-coverage" aria-label="Market coverage">{[
      ["01 / CRYPTO", "BTC · ETH", "CoinGecko reference", "/markets/assets"],
      ["02 / FOREX", "EUR/USD · USD/JPY", "ECB daily reference", "/markets/forex"],
      ["03 / METALS", "GOLD · SILVER", "GC=F · SI=F futures", "/dashboard#commodities"],
      ["04 / ENERGY", "WTI · BRENT", "CL=F · BZ=F futures", "/dashboard#commodities"],
    ].map(([label, title, source, href]) => <Link href={href} className="td-panel" key={label}><span className="td-label">{label}</span><strong>{title}</strong><small>{source}<span>↗</span></small></Link>)}</section>
    <section className="td-torus-panel td-panel">
      <div className="td-torus-heading"><span className="td-label">MARKET STRUCTURE / PARTICLE FIELD</span></div>
      <div className="td-torus-layout"><div className="td-torus-stage"><TerminalTorus /><div className="td-torus-caption">DECORATIVE VISUALIZATION · NO MARKET DATA</div></div><aside className="td-torus-metrics"><div><span>WORKSPACE</span><strong>FX / BTC</strong><small>Metals &amp; energy</small></div><div><span>RESEARCH TOOLS</span><strong>OHLC</strong><small>Price history · Market breadth</small></div><div><span>ACCESS</span><strong>SECURE</strong><small>Approved members</small></div><Link href="/dashboard" className="terminal-open">OPEN TERMINAL ↗</Link></aside></div>
    </section>
    <footer className="td-terminal-footer"><span>RFX BTC TEAM CAMBODIA</span><span>REFERENCE DATA MAY BE DELAYED</span><span>NO BROKER EXECUTION</span></footer>
  </main>;
}
