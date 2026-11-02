export default function Loading() {
  return (
    <main className="system-loading" role="status" aria-live="polite" aria-label="NR BTC is loading">
      <div className="system-loading-content">
        <div className="system-loading-orbit" aria-hidden="true">
          <div className="system-loading-mark">
            <svg viewBox="0 0 32 32" focusable="false">
              <path d="M7 23v-5m6 5V11m6 12v-9m6 9V7" />
            </svg>
          </div>
        </div>
        <p className="system-loading-brand">NR BTC</p>
        <svg className="system-loading-wave" viewBox="0 0 120 30" aria-hidden="true">
          <path d="M2 19h27l9-8 9 14 9-17 9 9h20l9-9 10 16 7-5h7" />
        </svg>
      </div>
      <span className="system-loading-label">LOADING WORKSPACE</span>
    </main>
  );
}
