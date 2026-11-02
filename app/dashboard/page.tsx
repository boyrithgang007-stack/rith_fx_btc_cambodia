import AuthPanel from "../AuthPanel";
import MarketDashboard from "../MarketDashboard";
import { getCurrentUser } from "../lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return <AuthPanel redirectTo="/dashboard" />;
  return <MarketDashboard user={user} />;
}
