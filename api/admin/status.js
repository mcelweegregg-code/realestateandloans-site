// Dashboard data for both tabs. Gregg's role gets only what his view
// needs; the editor gets everything.

import { requireRole } from '../../lib/admin-auth.js';
import { sendJson } from '../../lib/http.js';
import {
  getEditorToggle,
  getUpcomingTopic,
  getTopicsQueue,
  getPendingPosts,
  getPublishedPosts,
} from '../../lib/admin-data.js';

export default async function handler(req, res) {
  const session = requireRole(req, res, ['gregg', 'editor']);
  if (!session) return;

  try {
    const upcomingTopic = await getUpcomingTopic();
    if (session.role === 'gregg') {
      return sendJson(res, 200, { role: 'gregg', email: session.email, upcomingTopic });
    }
    const [editorToggle, topicsQueue, pendingPosts, publishedPosts] = await Promise.all([
      getEditorToggle(),
      getTopicsQueue(),
      getPendingPosts(),
      getPublishedPosts(),
    ]);
    return sendJson(res, 200, {
      role: 'editor',
      email: session.email,
      upcomingTopic,
      editorToggle,
      topicsQueue,
      pendingPosts,
      publishedPosts,
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
