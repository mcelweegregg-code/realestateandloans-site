# realestateandloans.com — Launch Checklist (M7)

The authoritative runbook for taking the autoblog pipeline live. Work top to
bottom. `npm run preflight` machine-checks every gate it can; this document
covers those plus the live-credential and DNS steps it cannot.

**Completion bar:** M7 is not done until a real post has gone through the full
pipeline end to end — recorded or RAG-generated, **editor toggle ON**, approved
in `/admin`, committed, and confirmed live at its URL.

---

## A. Machine-checkable gates (`npm run preflight`)

Run `npm run preflight`. It must exit 0 (all PASS) before cutover. Current
known FAILs and how to clear them:

- [ ] **1. Delete sample posts.** Remove every `sample: true` file from
  `content/posts/`, then `npm run build:blog` to rebuild the manifest. The
  preflight hard-fails while any sample slug remains in `blog/index.json`.
  *Do this only after the real seed posts exist (section C), since the samples
  are the blog's only content and the prior-posts context until then.*
- [ ] **2. `.env` gitignored.** Already passing. Never commit real keys.
- [ ] **3. DST cron offset.** Already passing for the current date (PDT → 13 UTC).
  See the November flip in section E.
- [ ] **4. Replace placeholders.** Replace `APPS_SCRIPT_URL_PLACEHOLDER` in
  `contact.html` with the deployed contact-form Apps Script URL. (Preflight
  also catches any future `*_PLACEHOLDER` string values.)
- [ ] **5. `GREGG_EMAIL`.** Confirm `lib/notify.js` `GREGG_EMAIL`
  (`mcelweegregg@gmail.com`) is Gregg's live, monitored inbox for reminders.
- [ ] **12. Editor toggle ON.** The migration seeds `editor_toggle=on`. Confirm
  the live `system_config` value is `on` before go-live (section D).

---

## B. Provision services and environment

Set every variable from `.env.example` in the Vercel project (and locally in
`.env` for the live dry run). Source per service:

- [ ] **Supabase:** create the project; run `supabase/migrations/0001_init.sql`
  then `0002_social_drafts.sql` in the SQL editor. Confirm `pgvector` enabled
  and `match_content_chunks` exists. Set `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Anthropic:** `ANTHROPIC_API_KEY` (generation, `claude-sonnet-4-6`).
- [ ] **OpenAI:** `OPENAI_API_KEY` (Whisper transcription + RAG embeddings).
- [ ] **GitHub:** `GITHUB_TOKEN` (contents read/write on this repo),
  `GITHUB_REPO` (`owner/name`), `GITHUB_BRANCH` (`main`). **The repo needs a
  GitHub remote and an initial push first — it has none yet.**
- [ ] **Google OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; authorized
  redirect URI `<origin>/api/auth/google`. `SESSION_SECRET` = long random string.
- [ ] **Resend:** `RESEND_API_KEY`; verify the `noreply@realestateandloans.com`
  sender domain.
- [ ] **Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_WHATSAPP_FROM`, and `GREGG_WHATSAPP_NUMBER` (**pending from Simo**).
- [ ] **Apps Script (social log):** deploy `apps-script/social-log-handler.gs`
  as its **own** project (separate from the contact-form handler — one
  `doPost` per web app). Set its `WEBHOOK_SECRET` script property; put the same
  value in `SHEETS_WEBHOOK_SECRET` and the deployment URL in `SHEETS_WEBHOOK_URL`.
- [ ] **Cron:** `CRON_SECRET` (Vercel sends it as a Bearer token to the cron
  endpoints).
- [ ] **Verification:** leave `VERIFY_BASE_URL` empty until DNS cutover, then
  set it to `https://realestateandloans.com`.

---

## C. Live pipeline dry run (the real test)

Do this against production services with **editor toggle ON**, before DNS
cutover, using a throwaway test topic.

- [ ] **6. Live generation.** Seed one test topic (`npm run seed topics ...`).
  Run `node scripts/test-generation.js --topic <file> --transcript <file>`
  (no `--mock`) with the real `ANTHROPIC_API_KEY`. Read the output against the
  M3 mock and the voice profile; iterate the prompts in `lib/generation/` if
  the live model drifts from Gregg's voice. **This is an iteration loop, not
  pass/fail.**
- [ ] **7. Live Whisper.** Open `/admin` as Gregg, record a short memo, submit.
  Confirm the transcript saved to `voice_memos` and the topic flipped to
  `recorded`.
- [ ] **9. Live Supabase writes.** Confirm rows appear in `topics`,
  `voice_memos`, and (after generation) `posts` with the draft + social fields.
- [ ] **RAG path.** Run `node scripts/index-embeddings.js` to backfill
  `content_chunks`. Trigger a publish-cron run for a topic with no memo and
  confirm the RAG fallback retrieves real, relevant chunks (mock embeddings are
  not semantic; only the live run proves relevance).
- [ ] **8 + 10. Live commit + verification.** With toggle ON, approve the draft
  in the Editor tab → **Publish**. Confirm: one single GitHub commit
  (post `.md`/HTML + `index.json` + `index.html` + `sitemap.xml`), Vercel
  deploys once, the Sheet row is written, and `VERIFY_BASE_URL` polling reports
  the post live.

---

## D. Pre-cutover confirmations

- [ ] **12. Editor toggle ON** in live `system_config` (so nothing
  auto-publishes during launch).
- [ ] greggmcelwee.com About page updated (old Agent Elite copy undercuts the
  cross-links from posts).
- [ ] Pool A internal links: re-add the `/guides/...` URLs in
  `lib/generation/prompts.js` once those guide pages are built (trimmed for now).
- [ ] Gregg's sign-off on the site.

---

## E. DNS cutover (Cloudflare → Vercel)

Reconcile with the project migration plan; standard steps:

- [ ] Add `realestateandloans.com` (and `www`) as domains in the Vercel project.
- [ ] In Cloudflare DNS, point the apex/`www` records at Vercel's targets
  (A `76.76.21.21` / the CNAME Vercel shows). Set Cloudflare SSL mode to **Full**
  and disable the orange-cloud proxy on these records during cutover to avoid
  double-proxy TLS issues; re-enable only if confirmed compatible.
- [ ] Wait for propagation; confirm HTTPS resolves to the Vercel deployment.
- [ ] Verify the old Agent Elite redirect map in `404.html` still fires for
  legacy URLs.
- [ ] Set `VERIFY_BASE_URL=https://realestateandloans.com` and re-run a publish
  verification.

---

## F. Post-launch

- [ ] Submit `sitemap.xml` in Google Search Console.
- [ ] Confirm the two Vercel cron jobs are registered and fire (check logs after
  the first scheduled run).
- [ ] **November DST flip:** when Pacific switches to PST (UTC-8), change both
  `vercel.json` cron schedules from hour `13` to `14` (`0 14` and `2 14`) so
  publish stays at 6:02 AM Pacific. `npm run preflight` will FAIL gate 3 until
  this is done.
