import Link from "next/link";
import AuthPanel from "../../AuthPanel";
import { ThemeModeButton, ThemeScope } from "../../ThemeControls";
import { getCurrentUser } from "../../lib/auth";
import AdminMembers from "./AdminMembers";

export default async function AdminMembersPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthPanel redirectTo="/admin/members" />;
  if (user.role !== "admin") {
    return <ThemeScope><main className="connections-page admin-members-page"><header className="connections-header">
      <Link href="/" className="connections-brand"><span aria-hidden="true">NR</span> MARKET WATCH</Link>
      <ThemeModeButton />
      <Link href="/dashboard" className="connections-back">← ត្រឡប់ទៅ Dashboard</Link>
    </header><div className="connections-content">
      <section className="connections-intro"><p className="connections-eyebrow">ADMIN ACCESS</p><h1>គ្មានសិទ្ធិចូលប្រើ</h1>
        <p>ទំព័រនេះសម្រាប់តែអ្នកគ្រប់គ្រងប្រព័ន្ធប៉ុណ្ណោះ។</p></section>
    </div></main></ThemeScope>;
  }
  return <ThemeScope><main className="connections-page admin-members-page"><header className="connections-header">
    <Link href="/" className="connections-brand"><span aria-hidden="true">NR</span> MARKET WATCH</Link>
    <ThemeModeButton />
    <Link href="/dashboard" className="connections-back">← ត្រឡប់ទៅ Dashboard</Link>
  </header><AdminMembers /></main></ThemeScope>;
}
