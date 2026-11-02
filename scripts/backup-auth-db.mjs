import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

const source = path.resolve(process.env.AUTH_DB_PATH || "./data/auth.sqlite");
const directory = path.resolve(process.argv[2] || "./backups");
if (source === directory || directory.startsWith(`${source}${path.sep}`)) {
  throw new Error("Backup destination must be outside the auth database file.");
}

await mkdir(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const destination = path.join(directory, `auth-${stamp}.sqlite`);
const temporary = path.join(directory, `.auth-${stamp}-${randomUUID()}.tmp`);
const database = new Database(source, { readonly: true, fileMustExist: true });
try {
  await database.backup(temporary);
  await rename(temporary, destination);
  console.log(`Created SQLite backup: ${destination}`);
} finally {
  database.close();
  await rm(temporary, { force: true });
}
