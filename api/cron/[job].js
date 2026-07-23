// Single Vercel function for the two cron jobs, consolidated to stay
// under the Hobby 12-function cap. vercel.json still points at
// /api/cron/reminder and /api/cron/publish — the [job] segment resolves
// them, so the schedule config is untouched. Implementations live in
// lib/endpoints/cron/.

import { sendJson } from '../../lib/http.js';
import publish from '../../lib/endpoints/cron/publish.js';
import reminder from '../../lib/endpoints/cron/reminder.js';

const ENDPOINTS = { publish, reminder };

export default function handler(req, res) {
  const segment = (req.query && req.query.job)
    || new URL(req.url, 'http://local').pathname.split('/').filter(Boolean).pop();
  const endpoint = ENDPOINTS[segment];
  if (!endpoint) return sendJson(res, 404, { error: 'no such endpoint' });
  return endpoint(req, res);
}
