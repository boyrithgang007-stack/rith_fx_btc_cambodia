const paths: Record<string, string> = {
  overview: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  macro: "M4 20V10m5 10V4m5 16v-7m5 7V7M2 21h20",
  charts: "M4 3v18h18M7 15l4-5 4 3 6-8",
  analysis: "m3 16 5-5 4 3 8-9M15 5h5v5",
  assets: "M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  watchlist: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  strategy: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6",
  forex: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
  home: "M19 12H5m6-6-6 6 6 6",
  account: "M4 5h16v15H4V5Zm0 4h16m-5 5h3",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6",
  learn: "M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14",
};

export default function SidebarIcon({ name }: { name: string }) {
  return <svg className="sidebar-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] ?? paths.account} /></svg>;
}
