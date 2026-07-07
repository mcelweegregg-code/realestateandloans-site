// Hourly link-injection sweep cron (see vercel.json). Picks up
// pending_review posts the link pipeline hasn't processed (up to 3 per
// run), injects external links, and stamps posts.links_checked_at.
// Requires SERPAPI_API_KEY + ANTHROPIC_API_KEY, and migrations 0007-0009
// applied. Returns a JSON summary; never crashes silently.

import { sendJson } from '../../lib/http.js';
import { authorizeCron } from '../../lib/cron.js';
import { runLinkSweep } from '../../lib/links/sweep.js';

export default async function handler(req, res) {
  if (!authorizeCron(req)) return sendJson(res, 401, { error: 'unauthorized' });
  try {
    const summary = await runLinkSweep();
    return sendJson(res, 200, summary);
  } catch (err) {
    return sendJson(res, 200, { job: 'link-sweep', ok: false, fatal: err.message });
  }
}
