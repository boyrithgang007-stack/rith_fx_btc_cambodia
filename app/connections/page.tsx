import Link from "next/link";
import ConnectedAccounts from "../ConnectedAccounts";
import AuthPanel from "../AuthPanel";
import { ThemeModeButton, ThemeScope } from "../ThemeControls";
import { getCurrentUser } from "../lib/auth";

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthPanel />;

  return (
    <ThemeScope>
    <main className="connections-page">
      <header className="connections-header">
        <Link href="/" className="connections-brand"><span aria-hidden="true">NR</span> MARKET WATCH</Link>
        <ThemeModeButton />
        <Link href="/" className="connections-back">← ត្រឡប់ទៅ Dashboard</Link>
      </header>

      <div className="connections-content">
        <section className="connections-intro">
          <p className="connections-eyebrow">ACCOUNT CENTER</p>
          <h1>គណនី និងការភ្ជាប់</h1>
          <p>មើលស្ថានភាពការភ្ជាប់គណនីទីផ្សារ និងគណនីហិរញ្ញវត្ថុរបស់អ្នកនៅកន្លែងតែមួយ។</p>
        </section>

        <section className="account-hub-grid" aria-label="ផ្នែកគណនីនីមួយៗ">
          <Link href="/accounts/balances"><span>01 · BALANCES</span><h2>សមតុល្យគណនី</h2><p>ស្ថានភាពសមតុល្យដែលបានអនុញ្ញាត</p><b>បើកផ្នែក ↗</b></Link>
          <Link href="/accounts/exchanges"><span>02 · CRYPTO</span><h2>Exchange accounts</h2><p>Binance · Bitget · OKX</p><b>បើកផ្នែក ↗</b></Link>
          <Link href="/accounts/mt5"><span>03 · FOREX</span><h2>MetaTrader 5</h2><p>គណនី MT5 តាម broker bridge</p><b>បើកផ្នែក ↗</b></Link>
          <Link href="/accounts/bank"><span>04 · BANKING</span><h2>គណនីធនាគារ</h2><p>Open Banking តាមតំបន់ដែលគាំទ្រ</p><b>បើកផ្នែក ↗</b></Link>
        </section>

        <ConnectedAccounts showForm={false} />
      </div>
    </main>
    </ThemeScope>
  );
}
