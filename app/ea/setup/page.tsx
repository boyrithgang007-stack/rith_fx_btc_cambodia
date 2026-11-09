import Link from "next/link";
import AuthPanel from "../../AuthPanel";
import ConnectedAccounts from "../../ConnectedAccounts";
import EaBotPanel from "../../EaBotPanel";
import { ThemeModeButton, ThemeScope } from "../../ThemeControls";
import { getCurrentUser } from "../../lib/auth";

export default async function EaSetupPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthPanel />;

  return <ThemeScope><main className="connections-page">
    <header className="connections-header">
      <Link href="/" className="connections-brand"><span aria-hidden="true">NR</span> MARKET WATCH</Link>
      <ThemeModeButton />
      <Link href="/connections" className="connections-back">← មជ្ឈមណ្ឌលគណនី</Link>
    </header>
    <div className="connections-content">
      <nav className="account-section-nav" aria-label="ផ្នែក setup EA">
        <Link href="/ea/setup" aria-current="page">EA setup</Link>
        <Link href="/accounts/mt5">MT5</Link>
        <Link href="/accounts/exchanges">Crypto exchanges</Link>
      </nav>
      <section className="connections-intro">
        <p className="connections-eyebrow">AUTOMATION · ACCOUNT SETUP</p>
        <h1>រៀបចំគណនី EA</h1>
        <p>ភ្ជាប់ Binance Futures Testnet និងគណនី MT5 ដោយខ្លួនឯង។ ពិនិត្យ readiness មុនប្រើ និងកុំដាក់ credentials គណនី live ក្នុងទម្រង់ Testnet ឬ read-only។</p>
      </section>
      <section className="connection-safety">
        <p className="connections-eyebrow">ស្ថានភាពបច្ចុប្បន្ន</p>
        <h2>កំណត់គណនីបាន · ការជួញដូរ live មិនទាន់បើក</h2>
        <p>Binance EA បច្ចុប្បន្នប្រើ Futures Testnet ប៉ុណ្ណោះ ហើយ worker ស្វ័យប្រវត្តិមិនរត់លើ Vercel ទេ។ MT5 form ខាងក្រោមភ្ជាប់ investor account សម្រាប់អានទិន្នន័យ; MT5 bridge បច្ចុប្បន្នមិនដាក់ order។</p>
      </section>

      <section aria-labelledby="ea-binance-setup-title">
        <h2 id="ea-binance-setup-title">1 · Binance Futures Testnet</h2>
        <p>បង្កើត Testnet API key ដែលមានសិទ្ធិ Futures សម្រាប់សាកល្បង។ ប្រព័ន្ធរក្សាទុក credentials ដោយអ៊ិនគ្រីប និងផ្ទៀងផ្ទាត់គណនីមុនអនុញ្ញាតបើក EA។</p>
        <EaBotPanel />
      </section>

      <section aria-labelledby="ea-mt5-setup-title">
        <h2 id="ea-mt5-setup-title">2 · Forex · MetaTrader 5</h2>
        <p>ភ្ជាប់ MT5 investor account ដើម្បីអាន balance និង candle។ ត្រូវមាន MT5 bridge ដែលអាចចូលបានពី server; localhost របស់កុំព្យូទ័រអ្នកមិនអាចឲ្យ Vercel ចូលបានទេ។</p>
        <ConnectedAccounts initialProvider="mt5" />
        <p className="settings-hint">ការភ្ជាប់នេះជា read-only។ វាមិនអាចដាក់ Forex order បានទេ។ ការដាក់ order លើ demo ត្រូវការការអភិវឌ្ឍ bridge និង worker ដាច់ដោយឡែក។</p>
      </section>
    </div>
  </main></ThemeScope>;
}
