// Whitelist + role guard for the admin API.
//
// Roles:
//   gregg  — (legacy) Gregg tab only; no longer assigned. Kept defined so the
//            role type stays valid if it is reintroduced later.
//   editor — everything (Record, Review, Add Content)
//
// Access was flattened: both whitelisted accounts now map to 'editor' so they
// get identical access to all three tabs. The whitelist membership is
// unchanged — both emails are still required to log in.
//
// ADMIN_MOCK=1 (local dev server only, never set in Vercel) bypasses the
// cookie and takes the role from the x-mock-role header so the UI can be
// exercised without Google credentials.

import { readSession } from './session.js';
import { sendJson } from './http.js';

export const WHITELIST = {
  'mcelweegregg@gmail.com': 'editor',
  'simon@bottbottgenai.com': 'editor',
};

export function getSession(req) {
  if (process.env.ADMIN_MOCK === '1') {
    const role = req.headers['x-mock-role'] === 'gregg' ? 'gregg' : 'editor';
    return { email: `mock-${role}@local`, role };
  }
  return readSession(req);
}

/** Returns the session, or responds 401/403 and returns null. */
export function requireRole(req, res, roles) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'not signed in' });
    return null;
  }
  if (!roles.includes(session.role)) {
    sendJson(res, 403, { error: 'not allowed for this role' });
    return null;
  }
  return session;
}
