// POST /api/admin/topics/bulk-upload — accept a single .md or .pdf file,
// extract its text, and ask Claude to parse blog topics out of it. Any topic
// missing guiding questions gets them auto-generated before the response.
//
// The file arrives as base64 JSON ({ filename, mime, data_base64 }) rather than
// multipart, matching api/admin/record.js so body handling is identical across
// Vercel and the local dev server with no extra dependency. Auth-gated.

import { requireRole } from '../../../lib/admin-auth.js';
import { sendJson, readJsonBody } from '../../../lib/http.js';
import { isMock } from '../../../lib/mock.js';
import { createAnthropicClient } from '../../../lib/generation/anthropic.js';
import {
  buildExtractPrompt,
  parseTopicsJson,
  backfillGuidingQuestions,
  TOPIC_CATEGORIES,
} from '../../../lib/admin-topics-ai.js';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const MOCK_TOPICS = [
  {
    title: 'Probate Court Approval: The Step Most Heirs Underestimate',
    description: 'What court confirmation actually involves and how it changes your sale timeline.',
    category: 'probate',
    main_keyword: 'probate court approval home sale California',
    guiding_questions: [
      'When is court confirmation required and when is it not?',
      'How long does the confirmation hearing add?',
      'What can derail it at the last minute?',
    ],
  },
  {
    title: 'Pricing a Divorce Sale When Emotions Run High',
    description: 'A practical framework for setting a price both parties can live with.',
    category: 'divorce',
    main_keyword: 'pricing home divorce sale Orange County',
    guiding_questions: [
      'How do you anchor the conversation to the market, not the marriage?',
      'What do you do when the two parties want different prices?',
      'When should they bring in a neutral appraisal?',
    ],
  },
];

async function extractText({ filename, mime, buffer }) {
  const name = (filename || '').toLowerCase();
  const isPdf = name.endsWith('.pdf') || mime === 'application/pdf';
  const isMd = name.endsWith('.md') || name.endsWith('.markdown') || mime === 'text/markdown';

  if (isMd) return buffer.toString('utf8');
  if (isPdf) {
    // pdf-parse is CommonJS; import the inner module directly to avoid its
    // index.js debug-mode file read when there is no module.parent.
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(buffer);
    return data.text || '';
  }
  throw new Error('only .md and .pdf files are accepted');
}

export default async function handler(req, res) {
  const session = requireRole(req, res, ['gregg', 'editor']);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });

  try {
    if (isMock()) return sendJson(res, 200, { topics: MOCK_TOPICS });

    const { filename, mime, data_base64: dataBase64 } = await readJsonBody(req);
    if (!dataBase64) return sendJson(res, 400, { error: 'data_base64 is required' });

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length === 0) return sendJson(res, 400, { error: 'file is empty' });
    if (buffer.length > MAX_FILE_BYTES) return sendJson(res, 413, { error: 'file too large (max 8MB)' });

    const text = await extractText({ filename, mime, buffer });
    if (!text || text.trim().length < 20) {
      return sendJson(res, 422, { error: 'could not read enough text from the file' });
    }

    const client = createAnthropicClient();
    const raw = await client({
      label: 'bulk topic extraction',
      prompt: buildExtractPrompt(text.slice(0, 40000)),
      maxTokens: 4096,
    });
    let topics = parseTopicsJson(raw).filter((t) => t.title);
    topics = await backfillGuidingQuestions(topics, client);
    topics = topics.filter((t) => TOPIC_CATEGORIES.includes(t.category) || !t.category);

    if (!topics.length) return sendJson(res, 502, { error: 'no topics could be extracted from the file' });
    return sendJson(res, 200, { topics });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
