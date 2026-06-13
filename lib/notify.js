// Notifications: email via Resend, WhatsApp via Twilio.
//
// Both transports are mock-aware (isMock() logs instead of sending) and
// degrade gracefully when credentials are absent: rather than throwing an
// unhandled error, send* returns { ok:false, skipped:true, reason } so the
// cron can record it in its summary and move on. Genuine API failures
// (bad request, network) return { ok:false, error } — also non-throwing.

import { isMock } from './mock.js';

const GREGG_EMAIL = 'mcelweegregg@gmail.com';
const EDITOR_EMAIL = 'simon@bottbottgenai.com';
const FROM_EMAIL = 'Simo <noreply@realestateandloans.com>';
const ADMIN_URL = 'https://realestateandloans.com/admin/';

// --- transports --------------------------------------------------------

export async function sendEmail({ to, subject, text }) {
  if (isMock()) {
    console.log(`[mock email] to=${to} subject="${subject}"`);
    return { ok: true, mock: true };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, reason: 'RESEND_API_KEY not set' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, id: (await res.json()).id };
  } catch (err) {
    return { ok: false, error: `Resend request failed: ${err.message}` };
  }
}

export async function sendWhatsApp({ to, body }) {
  if (isMock()) {
    console.log(`[mock whatsapp] to=${to} body="${body.slice(0, 60)}..."`);
    return { ok: true, mock: true };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!sid || !token || !from) {
    return { ok: false, skipped: true, reason: 'Twilio credentials (SID/TOKEN/FROM) not all set' };
  }
  if (!to) return { ok: false, skipped: true, reason: 'GREGG_WHATSAPP_NUMBER not set' };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${to.replace(/^whatsapp:/, '')}`, Body: body }),
    });
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, sid: (await res.json()).sid };
  } catch (err) {
    return { ok: false, error: `Twilio request failed: ${err.message}` };
  }
}

// --- message copy (from the autoblog plan) -----------------------------

export function reminderEmail(topic) {
  return {
    to: GREGG_EMAIL,
    subject: 'Your next blog post goes out tomorrow — 2 minutes needed',
    text: [
      'Hey Gregg,',
      '',
      `Tomorrow's post topic: ${topic.title}`,
      '',
      'Just record a quick voice note about it — whatever comes to mind. 2-3 minutes is plenty.',
      '',
      `Record here: ${ADMIN_URL}`,
      '',
      'Talk soon,',
      'Simo',
    ].join('\n'),
  };
}

export function reminderWhatsApp(topic, greggNumber) {
  return {
    to: greggNumber,
    body: `Hey Gregg — blog post goes out tomorrow. Topic: ${topic.title}. Takes 2 mins: ${ADMIN_URL}`,
  };
}

// Sent to the editor when a draft lands in pending_review (toggle ON).
export function reviewEmail(topic) {
  return {
    to: EDITOR_EMAIL,
    subject: `Post ready for review — ${topic.title}`,
    text: [
      'Draft is ready. Review and publish here:',
      '',
      ADMIN_URL,
      '',
      'It will not go live until you approve it (editor review is ON).',
    ].join('\n'),
  };
}

export { GREGG_EMAIL, EDITOR_EMAIL };
