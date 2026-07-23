// Single Vercel function for every /api/admin/* endpoint. The Hobby plan
// caps a deployment at 12 functions; routing the admin panel's six
// endpoints through one dynamic-segment file frees five slots without
// changing any URL. Implementations live in lib/endpoints/admin/ and are
// byte-for-byte the former api/admin/*.js handlers.
//
// Vercel populates req.query.endpoint from the [endpoint] segment; the
// dev server (scripts/dev-server.js) routes here by filename fallback, so
// the URL path is parsed as a second source of the segment name.

import { sendJson } from '../../lib/http.js';
import config from '../../lib/endpoints/admin/config.js';
import media from '../../lib/endpoints/admin/media.js';
import publish from '../../lib/endpoints/admin/publish.js';
import record from '../../lib/endpoints/admin/record.js';
import status from '../../lib/endpoints/admin/status.js';
import topics from '../../lib/endpoints/admin/topics.js';

const ENDPOINTS = { config, media, publish, record, status, topics };

export default function handler(req, res) {
  const segment = (req.query && req.query.endpoint)
    || new URL(req.url, 'http://local').pathname.split('/').filter(Boolean).pop();
  const endpoint = ENDPOINTS[segment];
  if (!endpoint) return sendJson(res, 404, { error: 'no such endpoint' });
  return endpoint(req, res);
}
