// Whitelist + role guard for the admin API.
//
// Roles:
//   gregg  — Gregg tab only (record voice memos)
//   editor — everything
//
// ADMIN_MOCK=1 (local dev server only, never set in Vercel) bypasses the
// cookie and takes the role from the x-mock-role header so the UI can be
// exercised without Google credentials.

import { readSession } from './session.js';
import { sendJson } from './http.js';

export const WHITELIST = {
  'mcelweegregg@gmail.com': 'gregg',
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
