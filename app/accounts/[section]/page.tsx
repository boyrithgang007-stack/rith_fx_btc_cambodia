import Link from "next/link";
import ConnectedAccounts from "../../ConnectedAccounts";
import BankPayments from "../../BankPayments";
import { notFound } from "next/navigation";
import AuthPanel from "../../AuthPanel";
import { ThemeModeButton, ThemeScope } from "../../ThemeControls";
import { getCurrentUser } from "../../lib/auth";

const sections = {
  balances: { title: "សមតុល្យគណនី", eyebrow: "ACCOUNT BALANCES", description: "មើលសមតុល្យដែលបានអនុញ្ញាតពីគណនី Exchange, MT5 និងធនាគារ។" },
  exchanges: { title: "Crypto Exchanges", eyebrow: "CRYPTO · EXCHANGES", description: "គ្រប់គ្រងការភ្ជាប់ Binance, Bitget, OKX និង Exchange ផ្សេងៗ។" },
  mt5: { title: "Forex · MetaTrader 5", eyebrow: "FOREX · MT5", description: "តភ្ជាប់គណនី MT5 តាមរយៈ bridge ដែលគាំទ្រ broker និង server របស់អ្នក។" },
  bank: { title: "គណនីធនាគារ", eyebrow: "BANKING", description: "ពិនិត្យសមតុល្យតាម Open Banking provider ដែលមានសិទ្ធិ និងគាំទ្រតំបន់របស់អ្នក។" },
} as const;

type AccountSection = keyof typeof sections;

export default async function AccountSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  const user = await getCurrentUser();
  if (!user) return <AuthPanel />;
  const selected = sections[section as AccountSection];

  return <ThemeScope><main className="connections-page">
    <header className="connections-header">
      <Link href="/" className="connections-brand"><span aria-hidden="true">NR</span> MARKET WATCH</Link>
      <ThemeModeButton />
      <Link href="/connections" className="connections-back">← មជ្ឈមណ្ឌលគណនី</Link>
    </header>
    <div className="connections-content">
      <nav className="account-section-nav" aria-label="ផ្នែកគណនី">
        {Object.entries(sections).map(([key, item]) => <Link key={key} href={`/accounts/${key}`} aria-current={section === key ? "page" : undefined}>{item.title}</Link>)}
      </nav>
      <section className="connections-intro"><p className="connections-eyebrow">{selected.eyebrow}</p><h1>{selected.title}</h1><p>{selected.description}</p></section>
      {section === "balances" || section === "exchanges" || section === "mt5" ?
        <ConnectedAccounts initialProvider={section === "mt5" ? "mt5" : "binance"} showForm={section !== "balances"} /> :
        <><BankPayments /><section className="connection-grid">
          {["ABA Bank", "ACLEDA Bank"].map(bank => <article key={bank} className="connection-card"><h3>{bank}</h3><span className="connection-status">មិនទាន់ភ្ជាប់សមតុល្យធនាគារ</span><p>ការមើលសមតុល្យត្រូវការ API និងការអនុម័តពីធនាគារ។ មុខងារនេះមិនទាន់មាន integration សម្រាប់សមតុល្យទេ។</p><p>សូមកុំបញ្ចូល password ធនាគារ ឬលេខ OTP នៅទីនេះ។</p></article>)}
        </section></>}
      <section className="connection-safety"><p className="connections-eyebrow">ACCOUNT ACCESS</p><h2>ការភ្ជាប់គណនីសម្រាប់អានទិន្នន័យ</h2><p>ប្រើ Exchange API keys ដែលអនុញ្ញាតតែការអាន។ Exness MT5 ប្រើ Investor password និង bridge ដែលបានកំណត់។ ប្រព័ន្ធបង្ហាញសមតុល្យ និងមិនផ្ញើបញ្ជាទិញលក់ទេ។</p></section>
    </div>
  </main></ThemeScope>;
}
