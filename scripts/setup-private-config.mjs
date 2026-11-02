import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const file = '.env.local';
let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const values = Object.fromEntries(content.split(/\r?\n/).map(line => line.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
function add(name, value) {
  if (values[name]) return;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(content)) content = content.replace(pattern, `${name}=${value}`);
  else content += `\n${name}=${value}\n`;
}
let previousSecret;
const databasePath = values.AUTH_DB_PATH || './data/auth.sqlite';
if (!values.AUTH_SECRET && fs.existsSync(databasePath)) {
  const db = new Database(databasePath, { readonly: true });
  try { previousSecret = db.prepare("SELECT value FROM app_secrets WHERE name='development-session-key'").get()?.value; }
  finally { db.close(); }
}
add('AUTH_SECRET', previousSecret || crypto.randomBytes(32).toString('base64url'));
add('EXCHANGE_ENCRYPTION_KEY', crypto.randomBytes(32).toString('hex'));
add('MT5_BRIDGE_TOKEN', crypto.randomBytes(32).toString('hex'));
add('MT5_BRIDGE_URL', 'http://127.0.0.1:8787');
fs.writeFileSync(file, content, { mode: 0o600 });
console.log('Private configuration prepared. Existing keys preserved; secret values are never printed.');
