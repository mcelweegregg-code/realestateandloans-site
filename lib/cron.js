// Cron job core logic, separated from the HTTP handlers so it can be run
// directly by the test harness. Every per-topic step is wrapped so one
// failure (missing credential, API error) is recorded in the summary
// rather than crashing the whole job — satisfies "graceful, not silent".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isMock } from './mock.js';
import { runGeneration } from './generation/engine.js';
import {
  sendEmail, sendWhatsApp, reminderEmail, reminderWhatsApp, reviewEmail,
} from './notify.js';
import { retrieveChunks, formatChunksForPrompt, indexContent } from './rag.js';
import {
  getTopicsScheduledFor, getReminderTopicsFor, getLatestVoiceMemo,
  markReminderSent, setTopicStatus, saveDraftPost, addDays, mockToday,
  selectImageForTopic, markImageUsed,
} from './cron-data.js';

const MOCK_FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..',
  'content', 'test-fixtures', 'mock-website-run',
);

// "Today" in America/Los_Angeles, so the date matches Gregg's timezone
// regardless of the server's UTC clock. MOCK_TODAY overrides for tests.
export function todayInLA() {
  if (isMock()) return mockToday();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

function readPriorPosts() {
  try {
    const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'blog', 'index.json'), 'utf8'));
    return manifest.posts.slice(0, 5).map((p) => ({ title: p.title, slug: p.slug }));
  } catch {
    return [];
  }
}

async function getGenerationClient(primaryKeyword, ragFlag) {
  if (isMock()) {
    const { createMockClient } = await import('./generation/mock-client.js');
    return createMockClient({ fixtureDir: MOCK_FIXTURE_DIR, primaryKeyword, ragFlag });
  }
  const { createAnthropicClient } = await import('./generation/anthropic.js');
  return createAnthropicClient();
}

// Generate a post for a topic. Path A = voice memo (transcript); Path B =
// RAG fallback (no memo). Returns { result, mode, voiceMemoId }.
async function generateForTopic(topic) {
  const memo = await getLatestVoiceMemo(topic.id);
  const priorPosts = readPriorPosts();

  const baseInputs = {
    topicTitle: topic.title,
    topicDescription: topic.description,
    primaryKeyword: topic.primary_keyword,
    guidingQuestions: topic.guiding_questions || [],
    priorPosts,
  };

  let inputs, mode, voiceMemoId = null;
  if (memo) {
    inputs = { ...baseInputs, transcript: memo.transcript, ragFlag: false, ragChunks: null };
    mode = 'voice_memo';
    voiceMemoId = memo.id;
  } else {
    const chunks = await retrieveChunks(topic);
    inputs = {
      ...baseInputs,
      transcript: null,
      ragFlag: true,
      ragChunks: chunks.length ? formatChunksForPrompt(chunks) : '(no related content found in the database)',
    };
    mode = 'rag_fallback';
  }

  const client = await getGenerationClient(topic.primary_keyword, inputs.ragFlag);
  const result = await runGeneration(inputs, client);
  return { result, mode, voiceMemoId };
}

async function publishGenerated(topic, result, voiceMemoId, date) {
  const craftAudit = [result.craftAudit ?? '(none)', '', 'LINT:', JSON.stringify(result.lint)].join('\n');
  if (isMock()) {
    return { postUrl: `https://realestateandloans.com/blog/${result.package.post.slug}`, commitSha: 'mock-commit', postCommitErrors: [], mock: true };
  }
  // Loosely link an image by category (best-effort; never blocks publish).
  let image = null;
  try {
    image = await selectImageForTopic(topic.category);
  } catch (err) {
    console.error(`image selection failed for topic ${topic.id}: ${err.message}`);
  }

  const { publishPost } = await import('./publish.js');
  const pub = await publishPost({
    pkg: result.package, date, topicId: topic.id, voiceMemoId, craftAudit,
    imageFilename: image?.filename ?? null,
    imageAlt: image?.alt_text ?? null,
  });

  if (image && pub.supabaseId) {
    try {
      await markImageUsed(image.id, pub.supabaseId);
    } catch (err) {
      pub.postCommitErrors.push({ step: 'image_mark', error: err.message });
    }
  }

  // Newly published post becomes a future RAG source.
  try {
    await indexContent({ sourceType: 'post', sourceId: pub.supabaseId, text: result.package.post.body_md });
  } catch (err) {
    pub.postCommitErrors.push({ step: 'rag_index', error: err.message });
  }
  return pub;
}

async function saveAsPendingReview(topic, result, voiceMemoId) {
  const { post, social } = result.package;
  const craftAudit = [result.craftAudit ?? '(none)', '', 'LINT:', JSON.stringify(result.lint, null, 2)].join('\n');

  // Loosely link an image by category (best-effort; never blocks the draft).
  let image = null;
  try {
    image = await selectImageForTopic(topic.category);
  } catch (err) {
    console.error(`image selection failed for topic ${topic.id}: ${err.message}`);
  }

  const saved = await saveDraftPost({
    topic_id: topic.id,
    voice_memo_id: voiceMemoId,
    slug: post.slug,
    title: post.title,
    body_md: post.body_md,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    primary_keyword: post.primary_keyword,
    keywords_used: [post.primary_keyword],
    internal_link_a: post.internal_link_a,
    internal_link_b: post.internal_link_b,
    rag_fallback: Boolean(post.rag_fallback),
    social_linkedin: social.linkedin,
    social_facebook: social.facebook,
    image_used: image?.filename ?? null,
    craft_audit: craftAudit,
    status: 'pending_review',
  });

  if (image) {
    try {
      await markImageUsed(image.id, saved.id);
    } catch (err) {
      console.error(`marking image used failed for post ${saved.id}: ${err.message}`);
    }
  }
  return saved.id;
}

// ---- reminder job -----------------------------------------------------

export async function runReminderJob({ today = todayInLA() } = {}) {
  const target = addDays(today, 1); // posts going out tomorrow
  const summary = { job: 'reminder', today, target, processed: [], errors: [] };

  let topics;
  try {
    topics = await getReminderTopicsFor(target);
  } catch (err) {
    summary.errors.push({ step: 'load_topics', error: err.message });
    return summary;
  }

  const greggNumber = process.env.GREGG_WHATSAPP_NUMBER || null;
  for (const topic of topics) {
    const entry = { topicId: topic.id, title: topic.title, email: null, whatsapp: null };
    entry.email = await sendEmail(reminderEmail(topic));
    entry.whatsapp = await sendWhatsApp(reminderWhatsApp(topic, greggNumber));
    // Only advance status if at least one channel actually went out.
    if (entry.email.ok || entry.whatsapp.ok) {
      try { await markReminderSent(topic.id); entry.statusUpdated = true; }
      catch (err) { entry.statusUpdated = false; summary.errors.push({ topicId: topic.id, step: 'mark_reminder_sent', error: err.message }); }
    }
    summary.processed.push(entry);
  }
  return summary;
}

// ---- publish job ------------------------------------------------------

export async function runPublishJob({ today = todayInLA() } = {}) {
  const summary = { job: 'publish', today, editorToggle: null, processed: [], errors: [] };

  let topics, toggle;
  try {
    const { getEditorToggle } = await import('./admin-data.js');
    [topics, toggle] = await Promise.all([getTopicsScheduledFor(today), getEditorToggle()]);
  } catch (err) {
    summary.errors.push({ step: 'load', error: err.message });
    return summary;
  }
  summary.editorToggle = toggle;

  for (const topic of topics) {
    const entry = { topicId: topic.id, title: topic.title };
    try {
      await setTopicStatus(topic.id, 'generating');
      const { result, mode, voiceMemoId } = await generateForTopic(topic);
      entry.mode = mode;
      entry.slug = result.package.post.slug;
      entry.lintOk = result.lint.ok;

      if (toggle === 'off') {
        const pub = await publishGenerated(topic, result, voiceMemoId, today);
        entry.action = 'published';
        entry.postUrl = pub.postUrl;
        entry.commit = pub.commitSha;
        entry.postCommitErrors = pub.postCommitErrors;
        await setTopicStatus(topic.id, mode === 'rag_fallback' ? 'auto_generated' : 'published');
      } else {
        const postId = await saveAsPendingReview(topic, result, voiceMemoId);
        entry.action = 'pending_review';
        entry.postId = postId;
        entry.reviewPing = await sendEmail(reviewEmail(topic));
        await setTopicStatus(topic.id, 'generating'); // stays in generating until approved
      }
    } catch (err) {
      entry.action = 'failed';
      entry.error = err.message;
      summary.errors.push({ topicId: topic.id, step: entry.mode || 'generate', error: err.message });
    }
    summary.processed.push(entry);
  }
  return summary;
}

// Shared cron-secret guard for the HTTP handlers.
export function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured (local/preview); allow
  const header = req.headers.authorization || '';
  return header === `Bearer ${secret}`;
}
