import fs from 'node:fs';
import crypto from 'node:crypto';

const file = '.env.local';
let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const values = Object.fromEntries(content.split(/\r?\n/).map(line => line.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
function add(name, value) {
  if (values[name]) return;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(content)) content = content.replace(pattern, `${name}=${value}`);
  else content += `\n${name}=${value}\n`;
}
add('AUTH_SECRET', crypto.randomBytes(32).toString('base64url'));
add('EXCHANGE_ENCRYPTION_KEY', crypto.randomBytes(32).toString('hex'));
add('MT5_BRIDGE_TOKEN', crypto.randomBytes(32).toString('hex'));
add('MT5_BRIDGE_URL', 'http://127.0.0.1:8787');
fs.writeFileSync(file, content, { mode: 0o600 });
console.log('Private configuration prepared. Set DATABASE_URL to a Supabase transaction-pooler URI before starting the app. Existing keys were preserved; secret values are never printed.');
