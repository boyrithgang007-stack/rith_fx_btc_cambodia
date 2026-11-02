import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./loading.css";
import "./responsive-experience.css";
import "./desktop-experience.css";
import "./connections.css";
import "./design-theme.css";
import "./nr-surfaces.css";
import "./discover-wood.css";
import "./terminal-dashboard.css";
import "./portfolio.css";
import "./reference-terminal.css";
import "./layout-containment.css";
import "./workspace-design.css";
import "./depth-motion.css";
import "./cinematic-terminal.css";
import "./two-modes.css";
import "./learning.css";
import "./forex-factory.css";
import "./bloomberg-news.css";
import "./soft-depth.css";
import "./glass-overview.css";
import "./ocean-dark.css";
import "./control-buttons.css";
import "./application-design.css";
import "./sidebar-design.css";
import "./world-market.css";
import "./research-workbench.css";
import "./candle-signal.css";
import "./macro-globe.css";
import "./support.css";
import "./privacy.css";
import "./admin-members.css";
import "./home-community.css";
import "./neon-card-borders.css";
import "./dashboard-finance-theme.css";
import "./auth-experience.css";
import "./ea-bot.css";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export const metadata: Metadata = {
  title: "RITH FX BTC Cambodia | Market Observatory",
  description: "Forex, Binance, gold, silver and oil market reference and analysis tools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="km">
      <body>{children}</body>
    </html>
  );
}
