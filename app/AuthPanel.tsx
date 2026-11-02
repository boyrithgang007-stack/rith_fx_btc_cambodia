"use client";

import ControlButton from "./ControlButton";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAppTheme } from "./ThemeControls";
import { toggleAppTheme } from "./theme-store";
import AuthTransformPortrait from "./AuthTransformPortrait";

type Mode = "login" | "register";

export default function AuthPanel({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const router = useRouter();
  const theme = useAppTheme();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "មិនអាចបំពេញសំណើបានទេ។");
      if (result.status === "pending" || result.status === "verification_required") { setMessage(result.message); setPassword(""); setShowPassword(false); setMode("login"); }
      else {
        router.replace(redirectTo);
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មានបញ្ហាក្នុងការភ្ជាប់ server។");
    } finally {
      setPending(false);
    }
  }

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
    setError("");
    setPassword("");
  }

  return <main className={`access-screen theme-${theme}`} aria-label="Account access">
    <Link href="/" className="access-home-link">← ត្រឡប់ទៅទំព័រដើម</Link>
    <section className="access-card">
      <aside className="auth-visual" aria-label="RITH FX BTC Cambodia">
        <Link className="auth-visual-brand" href="/">
          <span className="auth-visual-mark">RFX</span>
          <span><strong>RITH FX BTC</strong><small>CAMBODIA · RFX TEAM</small></span>
        </Link>
        <div className="auth-visual-copy">
          <p className="auth-visual-eyebrow"><span /> MARKET OBSERVATORY</p>
          <h1>Trade with<br /><em>clarity.</em></h1>
          <p>ទីផ្សារហិរញ្ញវត្ថុ និងឧបករណ៍វិភាគរបស់អ្នក នៅក្នុងកន្លែងតែមួយ។</p>
        </div>
        <div className="auth-visual-orbit auth-visual-orbit-one" aria-hidden="true" />
        <div className="auth-visual-orbit auth-visual-orbit-two" aria-hidden="true" />
        <AuthTransformPortrait />
        <div className="auth-visual-caption"><span>FOREX · BINANCE · COMMODITIES</span><strong>RFX TEAM</strong></div>
      </aside>
      <div className="auth-form-wrap">
        <ControlButton className="auth-theme-toggle" type="button" onClick={toggleAppTheme} aria-label={theme === "dark" ? "ប្តូរទៅរបៀបភ្លឺ" : "ប្តូរទៅរបៀបងងឹត"}>{theme === "dark" ? "☼" : "☾"}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></ControlButton>
        <Link className="auth-mobile-brand access-brand" href="/"><span className="brand-symbol">RFX</span><span><strong>RITH FX BTC Cambodia</strong><small>FOREX · BINANCE · COMMODITIES</small></span></Link>
        <div className="auth-heading"><p className="eyebrow">SECURE WORKSPACE</p><h2>{mode === "login" ? "សូមស្វាគមន៍ត្រឡប់មកវិញ" : "បង្កើតគណនីថ្មី"}</h2><p>{mode === "login" ? "ចូលគណនីដើម្បីបើក market dashboard។" : "ផ្ទៀងផ្ទាត់អ៊ីមែល រួចរង់ចាំអ្នកគ្រប់គ្រងអនុម័ត មុនអាចចូលប្រើបាន។"}</p></div>
        <div className="auth-mode-switch" role="tablist" aria-label="ជ្រើសរើសសកម្មភាព"><ControlButton type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>ចូលគណនី</ControlButton><ControlButton type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>ចុះឈ្មោះ</ControlButton></div>
        <form className="auth-form" onSubmit={submit}>
          <label>អ៊ីមែល<input type="email" name="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          <div className="auth-password-field">
            <label htmlFor="auth-password">ពាក្យសម្ងាត់</label>
            <div className="auth-password-control">
              <input id="auth-password" type={showPassword ? "text" : "password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "register" ? 12 : 1} maxLength={72} aria-describedby="auth-password-hint" required />
              <ControlButton variant="ghost" controlSize="sm" type="button" className="auth-password-toggle" aria-controls="auth-password" aria-pressed={showPassword} aria-label={showPassword ? "លាក់ពាក្យសម្ងាត់" : "បង្ហាញពាក្យសម្ងាត់"} onClick={() => setShowPassword(value => !value)}>{showPassword ? "លាក់" : "បង្ហាញ"}</ControlButton>
            </div>
            <small id="auth-password-hint">{mode === "register" ? "យ៉ាងតិច 12 តួអក្សរ" : "បញ្ចូលពាក្យសម្ងាត់គណនីរបស់អ្នក"}</small>
          </div>
          {message && <p className="auth-success" role="status">{message}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <ControlButton className="auth-submit" type="submit" disabled={pending}>{pending ? "កំពុងដំណើរការ…" : mode === "login" ? "ចូលប្រើប្រាស់" : "ផ្ញើសំណើចុះឈ្មោះ"}<span>↗</span></ControlButton>
        </form>
        <p className="auth-privacy-link"><Link href="/privacy">សេចក្តីជូនដំណឹងអំពីឯកជនភាព</Link></p>
      </div>
    </section>
  </main>;
}