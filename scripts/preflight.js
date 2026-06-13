// M7 launch preflight. Machine-checks every gate that can be checked
// without live credentials, and lists the items that require a live run
// or human action. Exits non-zero if any hard gate FAILS, so it can be a
// pre-deploy guard.
//
// Usage: node scripts/preflight.js
//
// Categories:
//   PASS    — gate satisfied
//   FAIL    — blocks launch (non-zero exit)
//   MANUAL  — requires live credentials / DNS / human confirmation; listed,
//             does not fail the script (those are confirmed during the live run)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';

const results = [];
const pass = (item, detail) => results.push({ item, status: 'PASS', detail });
const fail = (item, detail) => results.push({ item, status: 'FAIL', detail });
const manual = (item, detail) => results.push({ item, status: 'MANUAL', detail });

// --- 1. No sample:true posts in the manifest (machine-enforced hard fail).
(() => {
  const postsDir = 'content/posts';
  const sampleSlugs = [];
  if (existsSync(postsDir)) {
    for (const file of readdirSync(postsDir).filter((f) => f.endsWith('.md'))) {
      const { data } = matter(readFileSync(`${postsDir}/${file}`, 'utf8'));
      if (data.sample === true) sampleSlugs.push(data.slug || file);
    }
  }
  const manifest = existsSync('blog/index.json')
    ? JSON.parse(readFileSync('blog/index.json', 'utf8')).posts.map((p) => p.slug) : [];
  const inManifest = sampleSlugs.filter((s) => manifest.includes(s));
  if (sampleSlugs.length === 0) {
    pass('1. sample posts', 'no sample:true posts present');
  } else {
    fail('1. sample posts', `delete before launch: ${sampleSlugs.join(', ')}` +
      (inManifest.length ? ` (in manifest: ${inManifest.join(', ')})` : ' (run build:blog to confirm manifest)'));
  }
})();

// --- 2. .env is gitignored.
(() => {
  try {
    execSync('git check-ignore .env', { stdio: 'pipe' });
    pass('2. .env gitignored', '.env is ignored by git');
  } catch {
    fail('2. .env gitignored', '.env is NOT gitignored — secrets could be committed');
  }
})();

// --- 3. Cron UTC offset matches current Pacific DST state.
(() => {
  const offsetHours = pacificOffset(new Date()); // -7 (PDT) or -8 (PST)
  const expectedHour = ((6 - offsetHours) % 24 + 24) % 24; // 6:02 AM PT in UTC
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const publishCron = (vercel.crons || []).find((c) => c.path.includes('publish'));
  if (!publishCron) { fail('3. DST cron offset', 'no publish cron found in vercel.json'); return; }
  const actualHour = Number(publishCron.schedule.split(' ')[1]);
  const zone = offsetHours === -7 ? 'PDT' : 'PST';
  if (actualHour === expectedHour) {
    pass('3. DST cron offset', `${zone} (UTC${offsetHours}) → publish cron hour ${actualHour} UTC is correct`);
  } else {
    fail('3. DST cron offset', `currently ${zone}: expected UTC hour ${expectedHour}, vercel.json has ${actualHour}. Update both crons.`);
  }
})();

// --- 4. No *_PLACEHOLDER tokens in shipped source.
// Walk the filesystem rather than `git grep`: working files may be
// untracked, and a launch gate must not pass just because nothing is
// committed yet.
(() => {
  const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', 'content']);
  const EXTS = new Set(['.html', '.js', '.gs', '.json']);
  // Only a quoted string VALUE counts (a placeholder assigned to a var or
  // attribute). Prose references in doc comments, which legitimately stay
  // in the source, are not blockers.
  const token = /['"][A-Z][A-Z0-9_]*_PLACEHOLDER\b/;
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Skip heavy/generated dirs at the top level; still scan apps-script etc.
        if (dir === '.' && SKIP_DIRS.has(entry.name)) continue;
        walk(`${dir}/${entry.name}`);
      } else if (EXTS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
        const lines = readFileSync(`${dir}/${entry.name}`, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (token.test(line)) hits.push(`${dir}/${entry.name}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk('.');
  if (hits.length === 0) pass('4. placeholders', 'no *_PLACEHOLDER tokens in source');
  else fail('4. placeholders', `replace before launch:\n      ${hits.join('\n      ')}`);
})();

// --- 5. Gregg-facing email addresses (confirm live).
(() => {
  const notify = readFileSync('lib/notify.js', 'utf8');
  const greggEmail = notify.match(/GREGG_EMAIL\s*=\s*'([^']+)'/)?.[1];
  manual('5. GREGG_EMAIL', `reminder emails go to "${greggEmail}". Confirm this is his live, monitored address.`);
})();

// --- 12. Editor toggle defaults ON.
(() => {
  const migration = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
  const defaultsOn = /'editor_toggle',\s*'on'/.test(migration);
  if (defaultsOn) {
    manual('12. editor toggle ON', 'migration seeds editor_toggle=on. Confirm the LIVE Supabase value is "on" before go-live.');
  } else {
    fail('12. editor toggle ON', 'migration does not seed editor_toggle=on');
  }
})();

// --- live-run / DNS items (cannot be machine-verified here).
manual('6. live generation', 'run with real ANTHROPIC_API_KEY; compare to mock; iterate prompts.');
manual('7. live Whisper', 'record a memo through /admin and confirm transcription.');
manual('8. live GitHub commit', 'publish with real GITHUB_TOKEN + GITHUB_REPO; confirm single commit.');
manual('9. live Supabase writes', 'apply migrations 0001+0002; confirm posts/voice_memos rows written.');
manual('10. deploy verification', 'set VERIFY_BASE_URL; confirm post-publish URL polling succeeds.');
manual('11. DNS cutover', 'follow docs/launch-checklist.md DNS section (Cloudflare → Vercel).');

// --- helpers
function pacificOffset(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour === '24' ? 0 : p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 3600000);
}

// --- report
const order = { FAIL: 0, MANUAL: 1, PASS: 2 };
results.sort((a, b) => order[a.status] - order[b.status] || a.item.localeCompare(b.item, undefined, { numeric: true }));
console.log('\nM7 LAUNCH PREFLIGHT\n' + '='.repeat(60));
for (const r of results) console.log(`  ${r.status.padEnd(6)} ${r.item}\n         ${r.detail}`);

const fails = results.filter((r) => r.status === 'FAIL').length;
const manuals = results.filter((r) => r.status === 'MANUAL').length;
console.log('='.repeat(60));
console.log(`${results.filter((r) => r.status === 'PASS').length} pass, ${fails} fail, ${manuals} manual/live`);
if (fails > 0) {
  console.log('\nLAUNCH BLOCKED: resolve all FAIL items first.');
  process.exit(1);
}
console.log('\nAll machine-checkable gates pass. Complete the MANUAL/live items during the live run.');
