export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startEaWorker } = await import("./app/lib/ea/worker");
  startEaWorker();
}
