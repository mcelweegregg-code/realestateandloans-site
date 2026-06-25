// POST /api/admin/topics/generate — ask Claude for 5 fresh, original blog
// topic ideas, de-duplicated against the existing topics table. Returns a JSON
// array of topic objects for the Add Content tab to preview as Save/Discard
// cards. Auth-gated like the rest of /api/admin/*.

import { requireRole } from '../../../lib/admin-auth.js';
import { sendJson } from '../../../lib/http.js';
import { isMock } from '../../../lib/mock.js';
import { getAllTopicTitles } from '../../../lib/admin-data.js';
import { createAnthropicClient } from '../../../lib/generation/anthropic.js';
import { buildGeneratePrompt, parseTopicsJson, TOPIC_CATEGORIES } from '../../../lib/admin-topics-ai.js';

const MOCK_TOPICS = [
  {
    title: 'What Happens to the House When Siblings Inherit It Together',
    description: 'Co-inherited probate homes are where families fall apart. How Gregg keeps the sale — and the relationships — intact.',
    category: 'probate',
    main_keyword: 'inherited house multiple siblings Orange County',
    guiding_questions: [
      'What goes wrong most often when siblings inherit a house together?',
      'How do you keep one heir from stalling the whole sale?',
      'What do you tell a family that can’t agree on a price?',
    ],
  },
  {
    title: 'Selling the Family Home in a Divorce Without Making It Worse',
    description: 'A neutral, practical look at timing, pricing, and communication when a divorcing couple has to sell.',
    category: 'divorce',
    main_keyword: 'selling home during divorce Orange County',
    guiding_questions: [
      'How do you stay neutral when two clients want opposite things?',
      'What’s the biggest mistake divorcing sellers make on price?',
      'When is it better to sell before the divorce is final?',
    ],
  },
  {
    title: 'San Clemente vs. Dana Point: Where Your Money Goes Further in 2026',
    description: 'A grounded comparison of two coastal markets Gregg has worked for decades.',
    category: 'market',
    main_keyword: 'San Clemente vs Dana Point real estate 2026',
    guiding_questions: [
      'What kind of buyer is each town really right for?',
      'Where are you seeing the better value this year?',
      'What surprises out-of-area buyers about these two markets?',
    ],
  },
  {
    title: 'The Estate Sale Timeline Nobody Explains to Executors',
    description: 'Court dates, cleanouts, appraisals, listing — what the months actually look like, in order.',
    category: 'probate',
    main_keyword: 'estate sale timeline California executor',
    guiding_questions: [
      'What’s the first thing an executor should do, and what can wait?',
      'Where do timelines usually slip?',
      'How early should they call an agent?',
    ],
  },
  {
    title: 'Why I Still Door-Knock After 40 Years in South County',
    description: 'A first-person take on community presence and why local reputation still closes deals.',
    category: 'community',
    main_keyword: 'local real estate agent South Orange County',
    guiding_questions: [
      'What does door-knocking get you that online leads don’t?',
      'How has the neighborhood changed over 40 years?',
      'What keeps you doing it?',
    ],
  },
];

export default async function handler(req, res) {
  const session = requireRole(req, res, ['gregg', 'editor']);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });

  try {
    if (isMock()) return sendJson(res, 200, { topics: MOCK_TOPICS });

    const existingTitles = await getAllTopicTitles();
    const client = createAnthropicClient();
    const text = await client({
      label: 'topic generation',
      prompt: buildGeneratePrompt(existingTitles),
      maxTokens: 2048,
    });
    const topics = parseTopicsJson(text)
      .filter((t) => t.title && TOPIC_CATEGORIES.includes(t.category))
      .slice(0, 5);

    if (!topics.length) return sendJson(res, 502, { error: 'topic generation returned no usable topics' });
    return sendJson(res, 200, { topics });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
