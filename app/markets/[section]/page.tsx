import { notFound } from "next/navigation";
import AuthPanel from "../../AuthPanel";
import MarketDashboard, { type DashboardView } from "../../MarketDashboard";
import { getCurrentUser } from "../../lib/auth";

const sections = new Set<DashboardView>(["overview", "macro", "charts", "analysis", "assets", "watchlist", "strategy", "forex", "settings"]);

export default async function MarketSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section as DashboardView)) notFound();
  const user = await getCurrentUser();
  if (!user) return <AuthPanel />;
  return <MarketDashboard user={user} view={section as DashboardView} />;
}
