"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import WelcomePortrait from "./WelcomePortrait";
import { ThemeModeButton, useAppTheme } from "./ThemeControls";
import BloombergNews from "./BloombergNews";
import MarketTicker from "./MarketTicker";
import PublicSocialLinks, { AdministratorAvatar } from "./PublicSocialLinks";

export default function PublicLanding({ signedIn, isAdmin, adminAvatar, activeMemberCount }: { signedIn: boolean; isAdmin: boolean; adminAvatar?: string | null; activeMemberCount: number }) {
  const theme = useAppTheme();
  const [language,setLanguage]=useState<"km"|"en">("km");
  const km=language==="km";
  const action=km ? signedIn ? "បើក Dashboard" : "ចូលប្រើប្រព័ន្ធ" : signedIn ? "Open dashboard" : "Enter workspace";
  const features=[
    {number:"01",title:"Forex reference",category:"CURRENCIES / DAILY REFERENCE",style:"fx",href:"/markets/forex",mark:"FX",text:km?"អត្រាយោងរូបិយប័ណ្ណ និងប្រវត្តិនៃការប្រែប្រួល។":"Currency reference rates and their historical context."},
    {number:"02",title:"Crypto & Binance",category:"DIGITAL ASSETS / MARKET CONTEXT",style:"crypto",href:"/markets/assets",mark:"₿",text:km?"តម្លៃទីផ្សារ ក្រាប និងទិន្នន័យទ្រព្យសកម្មឌីជីថល។":"Digital asset prices, charts and market research tools."},
    {number:"03",title:"Gold, silver & oil",category:"METALS / ENERGY",style:"metals",href:"/dashboard#commodities",mark:"Au / Ag",text:km?"មាស ប្រាក់ និងប្រេង WTI/Brent ក្នុងផ្ទាំងតែមួយ។":"Gold, silver and WTI/Brent futures in one workspace."},
    {number:"04",title:"Market research",category:"STRUCTURE / PAPER STRATEGY",style:"research",href:"/markets/analysis",mark:"↗",text:km?"ពិនិត្យ candles ទិសដៅទីផ្សារ និងយុទ្ធសាស្ត្រសាកល្បង។":"Explore candles, market structure and paper strategies."},
  ];
  return <main className={`welcome-page theme-${theme}`} id="top" lang={language}>
    <a href="#welcome-main" className="welcome-skip">{km?"ទៅមាតិកា":"Skip to content"}</a>
    <header className="welcome-nav">
      <Link className="welcome-brand" href="/" aria-label="RFX BTC TEAM Cambodia home">RFX<span>BTC TEAM · CAMBODIA</span><i aria-hidden="true">✳</i></Link>
      <div className="welcome-admin-contact" aria-label={km?"ទំនាក់ទំនងអ្នកគ្រប់គ្រង":"Contact the administrator"}>
        <a href="mailto:rithbtccambodia@gmail.com?subject=RITH%20FX%20BTC%20Administrator" aria-label={km?"ផ្ញើអ៊ីមែលទៅអ្នកគ្រប់គ្រង":"Email the administrator"}><span aria-hidden="true">✉</span><span>{km?"អ៊ីមែល":"Email"}</span></a>
        <a href="https://t.me/RFX_BTC_analyze" target="_blank" rel="noopener noreferrer" aria-label={km?"ចូលរួមសហគមន៍ Telegram":"Join the Telegram community"}><span aria-hidden="true">➤</span><span>Telegram</span></a>
      </div>
      <nav aria-label={km?"ម៉ឺនុយមេ":"Main navigation"}><a href="#about">{km?"អំពីប្រព័ន្ធ":"About"}</a><a href="#markets">{km?"ទីផ្សារ":"Markets"}</a><a href="#workspace">{km?"ចាប់ផ្ដើម":"Get started"}</a></nav>
      <div className="welcome-nav-actions"><ThemeModeButton/><button type="button" className="welcome-language" onClick={()=>setLanguage(km?"en":"km")} aria-label={km?"Switch to English":"ប្ដូរទៅភាសាខ្មែរ"}>{km?"EN":"ខ្មែរ"}</button><Link className="welcome-nav-cta" href="/dashboard">{action}<span>↗</span></Link></div>
    </header>
    <section className="welcome-guide-ticker" aria-label={km?"ការណែនាំ និងទំនាក់ទំនងអ្នកគ្រប់គ្រង":"Usage guide and administrator contact"}>
      <div className="welcome-guide-track">
        {[0,1].map(copy=><div className="welcome-guide-group" key={copy} aria-hidden={copy===1}>
          <span className="welcome-guide-item is-black">{km?"ចុច «Dashboard» ដើម្បីចូលប្រើផ្ទាំងទីផ្សារ":"Select “Dashboard” to open the market workspace"}</span>
          <span className="welcome-guide-item is-green">{km?"ជ្រើស Crypto, Forex ឬ CPI តាមម៉ឺនុយ ដើម្បីមើលទិន្នន័យ និងក្រាប":"Choose Crypto, Forex or CPI in the menu to explore data and charts"}</span>
          <span className="welcome-guide-item is-red">{km?"ត្រូវការជំនួយ? Email៖ rithbtccambodia@gmail.com · សហគមន៍ Telegram៖ @RFX_BTC_analyze":"Need help? Email: rithbtccambodia@gmail.com · Telegram community: @RFX_BTC_analyze"}</span>
        </div>)}
      </div>
    </section>
    <section className="welcome-hero" id="welcome-main" aria-labelledby="welcome-title">
      <div className="welcome-hero-copy"><p className="welcome-kicker">INDEPENDENT MARKET WORKSPACE</p><h1 id="welcome-title"><span>RFX</span><span>BTC TEAM<span className="welcome-title-dot">.</span></span></h1>
        <ul className="welcome-hero-facts"><li>BASED IN CAMBODIA</li><li>FOREX, CRYPTO & COMMODITIES</li><li>RESEARCH. CONTEXT. CLARITY.</li></ul>
        <p className="welcome-intro">{km?"សូមស្វាគមន៍មកកាន់ RFX BTC TEAM។ កន្លែងតែមួយសម្រាប់តាមដានទីផ្សារ និងស្វែងយល់ពីទិន្នន័យ។":"Welcome to RFX BTC TEAM. A personal workspace for following markets and understanding the data."}</p>
        <Link href="/dashboard" className="welcome-primary">{action}<span>↗</span></Link>
        <Link href="/learn" className="welcome-learn-link">{km?"សិក្សាទីផ្សារ →":"Learn the markets →"}</Link>
        <div className="welcome-member-proof" aria-label={km?`${activeMemberCount} គណនីបានអនុម័ត និងកំពុងប្រើ`:`${activeMemberCount} approved active accounts`}>
          <span className="welcome-member-proof-icon" aria-hidden="true">♙</span>
          <span className="welcome-member-proof-copy"><small>{km?"សហគមន៍សមាជិក":"MEMBER COMMUNITY"}</small><strong>{new Intl.NumberFormat(km ? "km-KH" : "en-US").format(activeMemberCount)}</strong><span>{km?"សមាជិកបានអនុម័ត និងកំពុងប្រើ":"approved active members"}</span></span>
        </div>
      </div>
      <WelcomePortrait/>
      <aside className="welcome-team-card welcome-admin-card" aria-label={km?"អ្នកគ្រប់គ្រងប្រព័ន្ធ":"System administrator"}>
        <span className="welcome-team-label">{km?"អ្នកគ្រប់គ្រងប្រព័ន្ធ":"SYSTEM ADMINISTRATOR"} <i>·</i> NR BTC</span>
        <div className="welcome-team-person is-admin">
          <AdministratorAvatar src={adminAvatar}/>
          <span className="welcome-team-details"><a className="welcome-team-name" href="https://t.me/BIGBOY_NR_99" target="_blank" rel="noopener noreferrer" aria-label="ទាក់ទង ម៉ៅសុវណ្ណារិទ្ធ តាម Telegram">ម៉ៅសុវណ្ណារិទ្ធ <svg className="welcome-verified-mark" viewBox="0 0 20 20" role="img" aria-label="Verified"><path d="M10 1.5 12.2 3l2.7-.1.9 2.5 2.2 1.5-.8 2.6.8 2.6-2.2 1.5-.9 2.5-2.7-.1L10 18l-2.2-1.5-2.7.1-.9-2.5L2 12.6l.8-2.6L2 7.4l2.2-1.5.9-2.5 2.7.1L10 1.5Z"/><path className="welcome-verified-tick" d="m6.8 9.9 2.1 2.1 4.5-4.6"/></svg></a><small>{km?"អ្នកគ្រប់គ្រងប្រព័ន្ធ":"System Administrator"}</small><a className="welcome-team-handle" href="https://t.me/BIGBOY_NR_99" target="_blank" rel="noopener noreferrer">@BIGBOY_NR_99</a></span>
          <span className="welcome-team-role">{km?"ADMIN":"ADMIN"}</span>
        </div>
        <PublicSocialLinks isAdmin={isAdmin} language={language}/>
      </aside>
      <div className="welcome-hero-foot"><a href="#about" className="welcome-scroll"><span>↓</span><small>SCROLL DOWN<br/>TO EXPLORE</small></a><span>FOREX / CRYPTO / METALS / ENERGY</span></div>
    </section>
    <div className="welcome-ticker" aria-hidden="true"><span>FOREX <i>✳</i> CRYPTO <i>✳</i> GOLD <i>✳</i> SILVER <i>✳</i> OIL <i>✳</i> RFX BTC TEAM <i>✳</i></span></div>
    <MarketTicker/>
    <section className="welcome-about" id="about"><div className="welcome-section-label"><span>01 / ABOUT</span><i>↘</i></div><div><p className="welcome-kicker">ONE WORKSPACE. CONNECTED MARKETS.</p><h2>{km?<>មើលទីផ្សារ។<br/><em>យល់ពីទិន្នន័យ។</em></>:<>Follow the markets.<br/><em>Keep the context.</em></>}</h2><p className="welcome-body">{km?"RFX BTC TEAM Cambodia រួមបញ្ចូល Forex, Crypto, មាស ប្រាក់ និងប្រេង ជាមួយក្រាប និងឧបករណ៍វិភាគ។ ពិនិត្យប្រភព និងពេលវេលាទិន្នន័យ ដើម្បីមើលទីផ្សារបានកាន់តែច្បាស់។":"RFX BTC TEAM Cambodia brings together Forex, crypto, metals and energy with charts and research tools. See the source and reference date behind the data."}</p><Link href="/dashboard" className="welcome-text-link">{action} <span>↗</span></Link></div></section>
    <section className="welcome-markets" id="markets" aria-labelledby="welcome-market-title"><div className="welcome-section-label"><span>02 / THE WORKSPACE</span><span>FOUR WAYS TO EXPLORE</span></div><h2 id="welcome-market-title">{km?"ស្វែងយល់ពីទីផ្សារ":"Explore the workspace"}<span className="welcome-small-star" aria-hidden="true">✳</span></h2><div className="welcome-project-grid">{features.map(feature=><Link href={feature.href} key={feature.number} className="welcome-project"><div className={`welcome-project-art welcome-art-${feature.style}`} aria-hidden="true"><span className="welcome-art-index">{feature.number} / RFX</span><b>{feature.mark}</b><span className="welcome-art-orbit"/><span className="welcome-art-orbit welcome-art-orbit-two"/><span className="welcome-art-caption">{feature.category}</span></div><div className="welcome-project-heading"><h3>{feature.title}</h3><span>↗</span></div><p>{feature.text}</p><span className="welcome-project-action">{km?"បើកមើល":"EXPLORE"} ↗</span></Link>)}</div></section>
    <BloombergNews language={language}/>
    <section className="welcome-final" id="workspace">
      <div className="welcome-final-copy">
        <p className="welcome-kicker">YOUR NEXT VIEW OF THE MARKET</p>
        <h2>{km?<>ចាប់ផ្ដើម<br/><em>ស្វែងយល់។</em></>:<>Let’s explore<br/><em>the markets.</em></>}</h2>
        <Link className="welcome-primary" href="/dashboard">{action}<span>↗</span></Link>
        <p>{km?"តម្លៃយោងអាចមានការយឺតយ៉ាវ។ គណនីត្រូវការការអនុម័ត។":"Reference quotes may be delayed. Account approval is required."}</p>
      </div>
      <div className="welcome-final-portrait" aria-hidden="true">
        <Image src="/images/rith-transform-portrait.png" alt="" fill sizes="(max-width:700px) 90vw, 48vw" />
      </div>
      <aside className="welcome-team-card welcome-partner-card" aria-label={km?"ដៃគូក្រុម":"Team partner"}>
        <span className="welcome-team-label">{km?"ដៃគូក្រុម":"TEAM PARTNER"} <i>·</i> NR BTC</span>
        <div className="welcome-team-person is-partner">
          <Image className="welcome-team-avatar welcome-team-avatar-image" src="/images/rith-transform-portrait.png" alt="REAK" width={52} height={52}/>
          <span className="welcome-team-details"><a className="welcome-team-name" href="https://t.me/Knureak" target="_blank" rel="noopener noreferrer" aria-label="Contact REAK on Telegram">REAK <svg className="welcome-verified-mark" viewBox="0 0 20 20" role="img" aria-label="Verified"><path d="M10 1.5 12.2 3l2.7-.1.9 2.5 2.2 1.5-.8 2.6.8 2.6-2.2 1.5-.9 2.5-2.7-.1L10 18l-2.2-1.5-2.7.1-.9-2.5L2 12.6l.8-2.6L2 7.4l2.2-1.5.9-2.5 2.7.1L10 1.5Z"/><path className="welcome-verified-tick" d="m6.8 9.9 2.1 2.1 4.5-4.6"/></svg></a><small>{km?"ដៃគូក្រុម":"Team Partner"}</small><small className="welcome-team-handle">@Knureak</small></span>
          <span className="welcome-team-role partner">{km?"PARTNER":"PARTNER"}</span>
        </div>
      </aside>
    </section>
    <footer className="welcome-footer"><Link href="/" className="welcome-brand">RFX<span>BTC TEAM · CAMBODIA</span></Link><span>MARKET RESEARCH · NO BROKER EXECUTION</span><a href="#top">BACK TO TOP ↑</a></footer>
    <a className="welcome-community-cta" href="https://t.me/RFX_BTC_analyze" target="_blank" rel="noopener noreferrer" aria-label="Join community on Telegram — free">
      <span className="welcome-community-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21.5 3.2 18.2 20c-.25 1.18-.92 1.48-1.86.92l-5.15-3.8-2.49 2.4c-.28.28-.52.52-1.06.52l.37-5.24 9.54-8.62c.41-.37-.09-.57-.64-.2L5.12 13.35.08 11.77c-1.1-.34-1.12-1.1.23-1.63L20.02 2.5c.92-.34 1.73.22 1.48.7Z"/></svg></span>
      <span className="welcome-community-copy"><strong>Join community</strong><small>TELEGRAM - FREE</small></span>
    </a>
  </main>;
}
