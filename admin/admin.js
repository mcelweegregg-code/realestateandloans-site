// Admin dashboard client. Talks to /api/admin/* and /api/auth/*.
// Role-driven: Gregg sees only the Record view; the editor sees both tabs.
// No build step, no framework, matches the rest of the site.

const $ = (sel) => document.querySelector(sel);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (res.status === 401) { showSignin('Your session expired. Sign in again.'); throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

function showSignin(msg) {
  $('#app').classList.add('hidden');
  $('#signin').classList.remove('hidden');
  if (msg) $('#signin-msg').textContent = msg;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d.length === 10 ? `${d}T00:00:00` : d)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ----------------------------------------------------------- Gregg view

const recorder = { mediaRecorder: null, chunks: [], blob: null, topicId: null };

function renderGregg(state) {
  const topic = state.upcomingTopic;
  if (!topic) {
    $('#g-topic').textContent = 'No upcoming topic';
    $('#record-status').textContent = 'Nothing scheduled right now. Check back soon.';
    return;
  }
  recorder.topicId = topic.id;
  $('#g-topic').textContent = topic.title;
  $('#g-date').textContent = topic.scheduled_date ? `Goes live ${fmtDate(topic.scheduled_date)}` : '';
  $('#g-questions').innerHTML = (topic.guiding_questions || [])
    .map((q) => `<li>${escapeHtml(q)}</li>`).join('');
  $('#record-btn').disabled = false;
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder.chunks = [];
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const options = { audioBitsPerSecond: 64000 };
  if (mimeType) options.mimeType = mimeType;
  recorder.mediaRecorder = new MediaRecorder(stream, options);
  recorder.mediaRecorder.ondataavailable = (e) => { if (e.data.size) recorder.chunks.push(e.data); };
  recorder.mediaRecorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    recorder.blob = new Blob(recorder.chunks, { type: recorder.mediaRecorder.mimeType });
    const playback = $('#playback');
    playback.src = URL.createObjectURL(recorder.blob);
    playback.classList.remove('hidden');
    $('#submit-btn').classList.remove('hidden');
    $('#record-status').textContent = 'Listen back, then submit, or record again to replace it.';
  };
  recorder.mediaRecorder.start();
  const btn = $('#record-btn');
  btn.textContent = 'Stop'; btn.classList.add('recording');
  $('#record-status').textContent = 'Recording… talk for a minute or two.';
}

function stopRecording() {
  recorder.mediaRecorder?.stop();
  const btn = $('#record-btn');
  btn.textContent = 'Record'; btn.classList.remove('recording');
}

function wireRecorder() {
  $('#record-btn').addEventListener('click', async () => {
    const btn = $('#record-btn');
    try {
      if (btn.classList.contains('recording')) stopRecording();
      else await startRecording();
    } catch {
      $('#record-status').innerHTML = '<span class="err">Microphone access was blocked. Allow it in your browser and try again.</span>';
    }
  });

  $('#submit-btn').addEventListener('click', async () => {
    if (!recorder.blob) return;
    $('#submit-btn').disabled = true;
    $('#record-status').textContent = 'Uploading and transcribing…';
    try {
      const audio_base64 = await blobToBase64(recorder.blob);
      const r = await api('/api/admin/record', {
        method: 'POST',
        body: JSON.stringify({ topic_id: recorder.topicId, audio_base64, mime: recorder.blob.type }),
      });
      $('#record-status').innerHTML = `Got it. The post will go live on schedule.<br><span class="meta">${escapeHtml(r.transcript_preview)}…</span>`;
      $('#record-btn').disabled = true;
      $('#submit-btn').classList.add('hidden');
    } catch (err) {
      $('#record-status').innerHTML = `<span class="err">${escapeHtml(err.message)}</span>`;
      $('#submit-btn').disabled = false;
    }
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------- Editor view

function renderEditor(state) {
  const on = state.editorToggle === 'on';
  $('#toggle').checked = on;
  updateToggleDesc(on);

  $('#pending').innerHTML = state.pendingPosts.length
    ? '' : '<p class="meta">No drafts waiting for review.</p>';
  state.pendingPosts.forEach((post) => $('#pending').appendChild(buildPostEditor(post)));

  $('#queue').innerHTML = state.topicsQueue.map((t) => `
    <div class="queue-item">
      <span>#${t.order_index} ${escapeHtml(t.title)}</span>
      <span class="meta">${fmtDate(t.scheduled_date)} <span class="badge">${escapeHtml(t.status)}</span></span>
    </div>`).join('') || '<p class="meta">Queue is empty.</p>';

  $('#published').innerHTML = state.publishedPosts.map((p) => `
    <div class="pub-item">
      <a href="/blog/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
      <span class="meta">${fmtDate(p.published_at)}</span>
    </div>`).join('') || '<p class="meta">Nothing published yet.</p>';
}

function updateToggleDesc(on) {
  $('#toggle-desc').textContent = on
    ? 'ON — drafts wait here for your approval before going live.'
    : 'OFF — drafts auto-publish at the scheduled time without review.';
}

function buildPostEditor(post) {
  const el = document.createElement('div');
  el.className = 'post-editor';
  const lintWarn = post.craft_audit && /FAIL/.test(post.craft_audit)
    ? '<div class="lint-warn">Lint flagged issues in this draft. Review the body before publishing.</div>' : '';
  el.innerHTML = `
    ${lintWarn}
    <div class="field">
      <label>Title</label>
      <input data-f="title" value="${escapeHtml(post.title)}">
    </div>
    <div class="field">
      <label>Meta title <span class="charcount"></span></label>
      <input data-f="meta_title" value="${escapeHtml(post.meta_title || '')}">
    </div>
    <div class="field">
      <label>Meta description <span class="charcount"></span></label>
      <input data-f="meta_description" value="${escapeHtml(post.meta_description || '')}">
    </div>
    <div class="field">
      <label>Keywords</label>
      <div class="chips">${(post.keywords_used || [post.primary_keyword]).filter(Boolean).map((k) => `<span>${escapeHtml(k)}</span>`).join('')}</div>
    </div>
    <div class="field">
      <label>Image</label>
      <p class="meta">${post.image_used ? escapeHtml(post.image_used) : 'None (image handling is a later phase)'}</p>
    </div>
    <div class="field">
      <label>Body (markdown)</label>
      <textarea class="body" data-f="body_md">${escapeHtml(post.body_md)}</textarea>
    </div>
    <div class="field">
      <label>LinkedIn draft</label>
      <textarea class="social" data-f="social_linkedin">${escapeHtml(post.social_linkedin || '')}</textarea>
    </div>
    <div class="field">
      <label>Facebook draft</label>
      <textarea class="social" data-f="social_facebook">${escapeHtml(post.social_facebook || '')}</textarea>
    </div>
    <button class="btn btn--primary" data-action="publish">Publish</button>
    <span class="publish-msg meta"></span>
  `;

  // Live char counts on the meta fields (55/155 SEO targets).
  const wireCount = (sel, max) => {
    const input = el.querySelector(`[data-f="${sel}"]`);
    const label = input.closest('.field').querySelector('.charcount');
    const upd = () => { label.textContent = `${input.value.length}/${max}`;
      label.style.color = input.value.length > max ? '#c0392b' : ''; };
    input.addEventListener('input', upd); upd();
  };
  wireCount('meta_title', 55);
  wireCount('meta_description', 155);

  el.querySelector('[data-action="publish"]').addEventListener('click', async (e) => {
    const btn = e.target;
    const msg = el.querySelector('.publish-msg');
    if (!confirm('Publish this post now? It will commit to the live site.')) return;
    btn.disabled = true; msg.textContent = 'Publishing…'; msg.className = 'publish-msg meta';
    const edits = {};
    el.querySelectorAll('[data-f]').forEach((i) => { edits[i.dataset.f] = i.value; });
    try {
      const r = await api('/api/admin/publish', { method: 'POST', body: JSON.stringify({ post_id: post.id, ...edits }) });
      msg.innerHTML = `Published. <a href="${escapeHtml(r.post_url)}" target="_blank" rel="noopener">View</a>`;
      if (r.post_commit_errors?.length) {
        msg.innerHTML += ` <span class="err">(some post-publish steps failed: ${r.post_commit_errors.map((x) => escapeHtml(x.step)).join(', ')})</span>`;
      }
      el.querySelector('[data-action="publish"]').disabled = true;
    } catch (err) {
      msg.innerHTML = `<span class="err">${escapeHtml(err.message)}</span>`;
      btn.disabled = false;
    }
  });

  return el;
}

function wireEditorChrome() {
  $('#toggle').addEventListener('change', async (e) => {
    const value = e.target.checked ? 'on' : 'off';
    updateToggleDesc(e.target.checked);
    try {
      await api('/api/admin/config', { method: 'POST', body: JSON.stringify({ editor_toggle: value }) });
    } catch (err) {
      alert(`Could not save toggle: ${err.message}`);
      e.target.checked = !e.target.checked;
      updateToggleDesc(e.target.checked);
    }
  });

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      const which = tab.dataset.tab;
      $('#view-gregg').classList.toggle('hidden', which !== 'gregg');
      $('#view-editor').classList.toggle('hidden', which !== 'editor');
    });
  });
}

// ----------------------------------------------------------------- init

async function init() {
  wireRecorder();
  let state;
  try {
    state = await api('/api/admin/status');
  } catch {
    return; // 401 already routed to sign-in
  }

  $('#app').classList.remove('hidden');
  $('#signin').classList.add('hidden');
  $('#who').textContent = state.email;

  renderGregg(state);

  if (state.role === 'editor') {
    $('#tabs').classList.remove('hidden');
    wireEditorChrome();
    renderEditor(state);
  } else {
    // Gregg role: no tabs, editor view stays hidden.
    $('#view-editor').remove();
  }
}

init();
