import { google } from 'googleapis';
import { Resend } from 'resend';
import { checkSpamRules, classifyWithAI } from '../lib/spam-filter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ result: 'error', message: 'Method not allowed' });
  }

  try {
    const { name, email, phone, category, message, timestamp, website } = req.body;

    if (!name || !email || !message || !category) {
      return res.status(400).json({ result: 'error', message: 'Please complete all required fields.' });
    }

    // --- Spam classification: rules first, AI only if inconclusive ---
    const spamResult = checkSpamRules({ website, message, email })
      || await classifyWithAI({ name, email, phone, category, message });

    // --- Google Sheets ---
    const keyJson = JSON.parse(Buffer.from(process.env.CONTACT_FORM_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials: keyJson,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (spamResult.flagged) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CONTACT_FORM_SHEETS_ID,
        range: 'Spam!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[timestamp, name, email, phone || '', category, message, spamResult.reason]],
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CONTACT_FORM_SHEETS_ID,
        range: 'Form Submissions!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[timestamp, name, email, phone || '', category, message, new Date().toISOString()]],
        },
      });

      // --- Resend: notify Gregg (skipped for flagged submissions) ---
      await resend.emails.send({
        from: 'Contact Form <noreply@realestateandloans.com>',
        to: process.env.CONTACT_NOTIFY_TO,
        subject: `New contact form submission: ${category} from ${name}`,
        text: `You have a new contact form submission.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nCategory: ${category}\nMessage:\n${message}\n\nSubmitted: ${timestamp}`,
        replyTo: email,
      });
    }

    // --- Resend: confirm to submitter (identical either way) ---
    const firstName = name.split(' ')[0];
    await resend.emails.send({
      from: 'Gregg McElwee <noreply@realestateandloans.com>',
      to: email,
      subject: 'Got your message | Gregg McElwee, Real Estate & Loans',
      text: `Hi ${firstName},\n\nThanks for reaching out. Your message came through and Gregg will be in touch shortly.\n\nIf you need to reach him directly in the meantime:\nPhone: (949) 448-0961\nEmail: Gregg@realestateandloans.com\n\nTalk soon,\nGregg McElwee\nReal Estate & Loans\nSan Clemente, California\nrealestateandloans.com`,
    });

    return res.status(200).json({ result: 'success' });

  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ result: 'error', message: 'Something went wrong. Please call 949.448.0961 directly.' });
  }
}
