import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

test('legacy SQLite backup creates a consistent copy without touching the source', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rfx-auth-backup-'));
  const source = path.join(directory, 'source.sqlite');
  const output = path.join(directory, 'backups');
  let database;
  let original;
  let backup;
  try {
    database = new Database(source);
    database.exec('CREATE TABLE probe (value TEXT NOT NULL)');
    database.prepare('INSERT INTO probe VALUES (?)').run('backup-ok');
    database.close();
    database = null;

    const result = spawnSync(process.execPath, ['scripts/backup-sqlite-legacy.mjs', output], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, AUTH_DB_PATH: source },
    });
    assert.equal(result.status, 0, result.stderr);
    const files = await readdir(output);
    assert.equal(files.length, 1);
    backup = new Database(path.join(output, files[0]), { readonly: true });
    assert.equal(backup.prepare('SELECT value FROM probe').get().value, 'backup-ok');
    backup.close();
    backup = null;
    original = new Database(source, { readonly: true });
    assert.equal(original.prepare('SELECT value FROM probe').get().value, 'backup-ok');
    original.close();
    original = null;
  } finally {
    database?.close();
    original?.close();
    backup?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
