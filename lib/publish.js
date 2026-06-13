// Publish flow: takes a generation package (Call 3 output) and makes the
// post live. Steps:
//   1. Hard validations (H1 count, slug collision) — these throw and abort.
//   2. Render the post page, updated blog index, manifest, and sitemap.
//   3. ONE atomic GitHub commit with all four files (see lib/github.js).
//   4. Supabase posts record.
//   5. Google Sheet social log row (Apps Script webhook).
//   6. Post-deploy verification: poll the live URL until it serves.
// Steps 4-6 run after the commit; their failures are reported in the result
// rather than thrown, because the post is already live at that point and
// the caller (cron or admin UI) decides how to alert.

import { checkH1 } from './generation/lint.js';
import {
  renderPostPage,
  renderBlogIndex,
  renderSitemap,
  toManifestEntry,
  computeReadMinutes,
} from './blog.js';

const SITE_ORIGIN = 'https://realestateandloans.com';

export function buildPublishFiles({ pkg, date, manifest }) {
  const { post } = pkg;

  // Hard fail per Simo's confirmed rule: exactly one H1 or no publish.
  if (!checkH1(post.body_md)) {
    const count = (post.body_md.match(/^# .+$/gm) || []).length;
    throw new Error(`PUBLISH BLOCKED: body_md must contain exactly one H1, found ${count}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`PUBLISH BLOCKED: invalid publish date "${date}"`);
  }
  if (manifest.posts.some((p) => p.slug === post.slug)) {
    throw new Error(`PUBLISH BLOCKED: slug "${post.slug}" already exists in the manifest`);
  }

  const postData = {
    slug: post.slug,
    title: post.title,
    date,
    metaTitle: post.meta_title,
    metaDescription: post.meta_description,
    bodyMd: post.body_md,
    image: null, // image handling deferred to v2
  };

  const entry = toManifestEntry(postData);
  const posts = [entry, ...manifest.posts].sort(
    (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
  );
  const others = posts.filter((p) => p.slug !== post.slug);

  return [
    { path: `blog/${post.slug}.html`, content: renderPostPage(postData, others) },
    { path: 'blog/index.json', content: JSON.stringify({ posts }, null, 2) + '\n' },
    { path: 'blog/index.html', content: renderBlogIndex(posts) },
    { path: 'sitemap.xml', content: renderSitemap(posts) },
  ];
}

export function buildSupabaseRecord({ pkg, date, topicId = null, voiceMemoId = null, craftAudit = null }) {
  const { post } = pkg;
  return {
    topic_id: topicId,
    voice_memo_id: voiceMemoId,
    slug: post.slug,
    title: post.title,
    body_md: post.body_md,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    primary_keyword: post.primary_keyword,
    internal_link_a: post.internal_link_a,
    internal_link_b: post.internal_link_b,
    rag_fallback: Boolean(post.rag_fallback),
    status: 'published',
    published_at: new Date().toISOString(),
    craft_audit: craftAudit,
  };
}

export function buildSheetRow({ pkg, date }) {
  const postUrl = `${SITE_ORIGIN}/blog/${pkg.post.slug}`;
  return {
    publish_date: date,
    topic: pkg.post.title,
    post_url: postUrl,
    linkedin_draft: pkg.social.linkedin.replaceAll('[POST_URL]', postUrl),
    facebook_draft: pkg.social.facebook.replaceAll('[POST_URL]', postUrl),
  };
}

async function writeSheetRow(row) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!url) throw new Error('SHEETS_WEBHOOK_URL is not set');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, type: 'social_log', row }),
  });
  // Apps Script web apps return 200 even for handled errors, so check body.
  const body = await res.text();
  if (!res.ok || !body.includes('"ok":true')) {
    throw new Error(`Sheet webhook failed: ${res.status} ${body.slice(0, 300)}`);
  }
}

async function verifyLive(slug, { attempts = 10, intervalMs = 15000 } = {}) {
  const baseUrl = process.env.VERIFY_BASE_URL;
  if (!baseUrl) return { skipped: true, reason: 'VERIFY_BASE_URL not set (pre-DNS-cutover)' };
  const url = `${baseUrl.replace(/\/$/, '')}/blog/${slug}`;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) return { skipped: false, url, ok: true };
    } catch {
      // network hiccup; keep polling
    }
  }
  return { skipped: false, url, ok: false };
}

/**
 * Publish a post for real. Throws on validation or commit failure; failures
 * after the commit are collected in result.postCommitErrors.
 *
 * existingPostId: pass when a posts row already exists (pending_review
 * approval path) — the Supabase insert is skipped and the caller updates
 * its own row. Without it (cron/CLI path), a new row is inserted.
 */
export async function publishPost({ pkg, date, topicId, voiceMemoId, craftAudit, existingPostId = null }) {
  const { fetchRepoFile, createSingleCommit } = await import('./github.js');
  const manifest = JSON.parse(await fetchRepoFile('blog/index.json'));

  const files = buildPublishFiles({ pkg, date, manifest });
  const commitSha = await createSingleCommit(
    `Publish blog post: ${pkg.post.slug}`,
    files,
  );

  const postCommitErrors = [];

  let supabaseId = existingPostId;
  if (!existingPostId) {
    try {
      const { getSupabaseClient } = await import('./supabase.js');
      const record = buildSupabaseRecord({ pkg, date, topicId, voiceMemoId, craftAudit });
      const { data, error } = await getSupabaseClient().from('posts').insert(record).select('id').single();
      if (error) throw new Error(error.message);
      supabaseId = data.id;
    } catch (err) {
      postCommitErrors.push({ step: 'supabase', error: err.message });
    }
  }

  try {
    await writeSheetRow(buildSheetRow({ pkg, date }));
  } catch (err) {
    postCommitErrors.push({ step: 'sheet', error: err.message });
  }

  const verification = await verifyLive(pkg.post.slug);
  if (verification.ok === false) {
    postCommitErrors.push({ step: 'verify', error: `post did not become reachable at ${verification.url}` });
  }

  return {
    commitSha,
    supabaseId,
    postUrl: `${SITE_ORIGIN}/blog/${pkg.post.slug}`,
    readMinutes: computeReadMinutes(pkg.post.body_md),
    verification,
    postCommitErrors,
  };
}
