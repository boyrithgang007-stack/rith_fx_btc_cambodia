import { spawn } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required to back up PostgreSQL.");
const directory = path.resolve(process.argv[2] || "./backups");
await mkdir(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const destination = path.join(directory, `database-${stamp}.dump`);
const temporary = path.join(directory, `.database-${stamp}-${randomUUID()}.tmp`);
const child = spawn("pg_dump", ["--format=custom", "--no-owner"], {
  env: { ...process.env, PGDATABASE: connectionString, PGSSLMODE: "require" },
  stdio: ["ignore", "pipe", "pipe"],
});
const stderr = [];
child.stderr.setEncoding("utf8").on("data", chunk => stderr.push(chunk));

try {
  const [exitCode] = await Promise.all([
    new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    }),
    pipeline(child.stdout, createWriteStream(temporary, { flags: "wx" })),
  ]);
  if (exitCode !== 0) throw new Error(`pg_dump failed: ${stderr.join("").trim() || `exit ${exitCode}`}`);
  await rename(temporary, destination);
  console.log(`Created PostgreSQL backup: ${destination}`);
} finally {
  if (child.exitCode === null) child.kill();
  await rm(temporary, { force: true });
}
