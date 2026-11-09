export async function register() {
  if (process.env.VERCEL === "1") return;
  const { startTelegramSignalWorker } = await import("./app/lib/telegram-signal-worker");
  startTelegramSignalWorker();
  const { startEnabledEaWorkers } = await import("./app/lib/ea/worker");
  try {
    await startEnabledEaWorkers();
  } catch {
    console.error("[ea-worker] Local worker startup deferred: database is unavailable.");
  }
}
