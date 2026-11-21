#!/usr/bin/env node
/**
 * Host-side admin CLI. Run inside the container:
 *
 *   docker exec -it clio-app node server/cli.js token create claude-desktop --days 365
 *   docker exec -it clio-app node server/cli.js token create ci-readonly --scope read
 *   docker exec -it clio-app node server/cli.js token list
 *   docker exec -it clio-app node server/cli.js token revoke <id>
 *   docker exec -it clio-app node server/cli.js sessions revoke-all
 *
 * This is also the break-glass path: whoever can `docker exec` on the host can always mint a token,
 * even if Google sign-in is misconfigured. The token is printed once and only its hash is stored.
 */
import { db } from './db.js';
import { createAuth, createGoogleClient } from './auth.js';

const auth = createAuth({ db, google: createGoogleClient({}), allowedEmails: new Set(), publicUrl: '' });
const [, , group, action, ...rest] = process.argv;

function flag(name, fallback) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
}

function usage() {
  console.error('usage: cli.js token create <name> [--scope read|write] [--days N]\n       cli.js token list\n       cli.js token revoke <id>\n       cli.js sessions revoke-all');
  process.exit(2);
}

if (group === 'token' && action === 'create') {
  const name = rest[0];
  if (!name || name.startsWith('--')) usage();
  const t = auth.createAccessToken({ name, scope: flag('scope', 'write'), expiresInDays: flag('days', null), createdBy: 'cli' });
  console.log(`Created token "${t.name}" (${t.scope}${t.expiresAt ? `, expires ${new Date(t.expiresAt).toISOString().slice(0, 10)}` : ', no expiry'})`);
  console.log('Copy it now; it cannot be shown again:\n');
  console.log(t.token);
} else if (group === 'token' && action === 'list') {
  for (const t of auth.listTokens()) {
    const state = t.revoked_at ? 'revoked' : t.expires_at && t.expires_at < Date.now() ? 'expired' : 'active';
    console.log(`${t.id}  ${state.padEnd(7)}  ${t.scope.padEnd(5)}  ${t.prefix}…  ${t.name}  (by ${t.created_by})`);
  }
} else if (group === 'token' && action === 'revoke' && rest[0]) {
  console.log(auth.revokeToken(rest[0]) ? 'Revoked.' : 'No active token with that id.');
} else if (group === 'sessions' && action === 'revoke-all') {
  console.log(`Signed out ${db.prepare('DELETE FROM auth_sessions').run().changes} session(s).`);
} else {
  usage();
}
