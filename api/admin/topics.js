// Topics collection endpoint for the admin panel.
//   GET  /api/admin/topics?status=upcoming  → topics with that status,
//        ordered by scheduled_date ascending (read-only queue view).
//   POST /api/admin/topics                  → insert a single topic. status
//        defaults to 'upcoming'; order_index is auto-assigned as max + 1.
//
// Auth-gated like the rest of /api/admin/* — any authenticated admin session.

import { requireRole } from '../../lib/admin-auth.js';
import { sendJson, readJsonBody, getQuery } from '../../lib/http.js';
import { createTopic, getTopicsByStatus } from '../../lib/admin-data.js';

const CATEGORIES = ['probate', 'divorce', 'market', 'community', 'buyer-seller', 'local'];

export default async function handler(req, res) {
  const session = requireRole(req, res, ['gregg', 'editor']);
  if (!session) return;

  try {
    if (req.method === 'GET') {
      const { status = 'upcoming' } = getQuery(req);
      const topics = await getTopicsByStatus(status);
      return sendJson(res, 200, { topics });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const title = (body.title || '').trim();
      const description = (body.description || '').trim();
      const category = (body.category || '').trim();
      const primaryKeyword = (body.main_keyword ?? body.primary_keyword ?? '').trim();
      const scheduledDate = (body.scheduled_date || '').trim();

      // guiding_questions may arrive as an array or a newline-delimited string.
      let guidingQuestions = body.guiding_questions ?? [];
      if (typeof guidingQuestions === 'string') {
        guidingQuestions = guidingQuestions.split('\n').map((q) => q.trim()).filter(Boolean);
      }
      guidingQuestions = (guidingQuestions || []).map((q) => String(q).trim()).filter(Boolean);

      if (!title || !description || !primaryKeyword || !guidingQuestions.length) {
        return sendJson(res, 400, {
          error: 'title, description, main_keyword and guiding_questions are required',
        });
      }
      if (category && !CATEGORIES.includes(category)) {
        return sendJson(res, 400, { error: `category must be one of: ${CATEGORIES.join(', ')}` });
      }

      const topic = await createTopic({
        title,
        description,
        category: category || null,
        primary_keyword: primaryKeyword,
        guiding_questions: guidingQuestions,
        scheduled_date: scheduledDate || null,
      });
      return sendJson(res, 200, { ok: true, topic });
    }

    return sendJson(res, 405, { error: 'method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
