// Single Vercel function for /api/auth/google and /api/auth/logout,
// consolidated to stay under the Hobby 12-function cap. URLs unchanged —
// /api/auth/google in particular is a registered Google OAuth redirect
// URI and must never move. Implementations live in lib/endpoints/auth/.

import { sendJson } from '../../lib/http.js';
import google from '../../lib/endpoints/auth/google.js';
import logout from '../../lib/endpoints/auth/logout.js';

const ENDPOINTS = { google, logout };

export default function handler(req, res) {
  const segment = (req.query && req.query.action)
    || new URL(req.url, 'http://local').pathname.split('/').filter(Boolean).pop();
  const endpoint = ENDPOINTS[segment];
  if (!endpoint) return sendJson(res, 404, { error: 'no such endpoint' });
  return endpoint(req, res);
}
