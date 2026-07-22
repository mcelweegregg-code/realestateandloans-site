import { google } from 'googleapis';
import { Resend } from 'resend';
import { checkSpamRules } from '../lib/spam-filter.js';
import { sendJson, readJsonBody } from '../lib/http.js';

// Shared endpoint for the two lead-tool forms (/home-value and
// /get-preapproved). Branches on formType; each branch validates its own
// fields against an allow-list and appends to its own Sheet tab.
//
// Order of operations differs deliberately from api/contact.js: the
// notification and confirmation emails go out BEFORE the Sheet write, and
// the Sheet write runs best-effort in its own try/catch, so a logging
// failure never swallows a lead.

const SIGNATURE = `Gregg McElwee
Real Estate & Loans
San Clemente, California
realestateandloans.com`;

const PREAPPROVAL_SIGNATURE = `Gregg McElwee
Real Estate & Loans
NMLS #352232 | American Home Realty
San Clemente, California
realestateandloans.com`;

const NUMBER_RE = /^\d+(\.\d+)?$/;

const FORM_TYPES = {
  'home-value': {
    sheetTab: 'Home Value Leads',
    headers: ['Submitted At', 'Full Name', 'Email', 'Phone', 'Address', 'Property Type', 'Beds', 'Baths', 'Approx Sq Ft', 'Reason', 'Timeline'],
    selects: {
      propertyType: ['Single-family', 'Condo / Townhome', 'Other'],
      reason: ['Thinking of selling', 'Probate / Estate', 'Divorce', 'Refinancing', 'Just curious'],
      timeline: ['ASAP', '3-6 months', '6-12 months', 'Just researching'],
    },
  },
  preapproval: {
    sheetTab: 'Preapproval Leads',
    headers: ['Submitted At', 'Full Name', 'Email', 'Phone', 'Purchase Price Range', 'Down Payment', 'Employment Type', 'Timeline'],
    selects: {
      priceRange: ['Under $750K', '$750K - $1M', '$1M - $1.5M', '$1.5M - $2M', 'Over $2M'],
      downPayment: ['Under 5%', '5-10%', '10-20%', '20%+'],
      employmentType: ['W-2 employee', 'Self-employed', 'Retired', 'Other'],
      timeline: ['ASAP', '3-6 months', '6-12 months', 'Just researching'],
    },
  },
};

function validate(formType, body) {
  const config = FORM_TYPES[formType];
  const { name, email, phone } = body;

  if (!name || !email) return 'Please complete all required fields.';

  // Every dropdown value must match its allow-list exactly. Client-side
  // checks are trivially bypassed by POSTing directly, so this is the gate.
  for (const [field, allowed] of Object.entries(config.selects)) {
    if (!allowed.includes(body[field])) return `Invalid value for ${field}.`;
  }

  if (formType === 'home-value') {
    if (!body.address || !String(body.address).trim()) return 'Please enter the property address.';
    if (!NUMBER_RE.test(String(body.beds)) || Number(body.beds) > 20) return 'Invalid value for beds.';
    if (!NUMBER_RE.test(String(body.baths)) || Number(body.baths) > 20) return 'Invalid value for baths.';
    if (body.sqft && (!NUMBER_RE.test(String(body.sqft)) || Number(body.sqft) > 50000)) return 'Invalid value for square footage.';
  }

  if (formType === 'preapproval' && (!phone || !String(phone).trim())) {
    return 'Please enter your phone number.';
  }

  return null;
}

function buildRow(formType, body, submittedAt) {
  const { name, email, phone } = body;
  if (formType === 'home-value') {
    return [submittedAt, name, email, phone || '', body.address, body.propertyType, body.beds, body.baths, body.sqft || '', body.reason, body.timeline];
  }
  return [submittedAt, name, email, phone, body.priceRange, body.downPayment, body.employmentType, body.timeline];
}

function buildGreggNotification(formType, body, submittedAt) {
  if (formType === 'home-value') {
    return {
      subject: `New home value request: ${body.reason} from ${body.name}`,
      text: `You have a new home value request from realestateandloans.com.

Name: ${body.name}
Email: ${body.email}
Phone: ${body.phone || 'Not provided'}
Address: ${body.address}
Property type: ${body.propertyType}
Beds / Baths: ${body.beds} / ${body.baths}
Approx sq ft: ${body.sqft || 'Not provided'}
Reason: ${body.reason}
Timeline: ${body.timeline}

Submitted: ${submittedAt}`,
    };
  }
  return {
    subject: `New preapproval request: ${body.timeline} from ${body.name}`,
    text: `You have a new preapproval request from realestateandloans.com.

Name: ${body.name}
Email: ${body.email}
Phone: ${body.phone}
Purchase price range: ${body.priceRange}
Down payment: ${body.downPayment}
Employment type: ${body.employmentType}
Timeline to buy: ${body.timeline}

Submitted: ${submittedAt}`,
  };
}

function buildConfirmation(formType, body) {
  const firstName = body.name.split(' ')[0];
  if (formType === 'home-value') {
    return {
      subject: 'Got your request | Gregg McElwee, Real Estate & Loans',
      text: `Hi ${firstName},

Thanks for the details on ${body.address}. I'll pull real comps, put together an honest estimate, and get back to you personally. No bots, no guesswork.

If you'd rather talk it through in the meantime:
Phone: (949) 448-0961
Email: Gregg@realestateandloans.com

Talk soon,
${SIGNATURE}`,
    };
  }
  return {
    subject: 'Your preapproval request | Gregg McElwee, Real Estate & Loans',
    text: `Hi ${firstName},

Got your request. This gets the conversation started. It isn't a credit check or a loan commitment. I'll call you to walk through real preapproval.

If you'd rather not wait for my call:
Phone: (949) 448-0961
Email: Gregg@realestateandloans.com

Talk soon,
${PREAPPROVAL_SIGNATURE}

Preapproval subject to full application, credit approval, and underwriting. Equal Housing Opportunity.`,
  };
}

// Appends a row, creating the tab and header row on first use. The Sheets
// API (unlike Apps Script) errors on appends to a tab that does not exist,
// so a failed append triggers one create-and-retry.
async function appendWithTabCreate(sheets, spreadsheetId, tab, headers, row) {
  const range = `'${tab}'!A:${String.fromCharCode(64 + headers.length)}`;
  const doAppend = (values) => sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  try {
    await doAppend([row]);
  } catch (err) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    await doAppend([headers, row]);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { result: 'error', message: 'Method not allowed' });
  }

  try {
    const body = (await readJsonBody(req)) || {};
    const { formType, name, email, phone, website } = body;

    const config = FORM_TYPES[formType];
    if (!config) {
      return sendJson(res, 400, { result: 'error', message: 'Invalid form type.' });
    }

    const validationError = validate(formType, body);
    if (validationError) {
      return sendJson(res, 400, { result: 'error', message: validationError });
    }

    // Rule-based spam checks only: these forms have no free-text message
    // for the AI classifier, so honeypot + email-domain rules carry the
    // load. The address doubles as the "message" for the URL check.
    const spamResult = checkSpamRules({ website, message: body.address, email }) || { flagged: false };

    // Single server-side timestamp used everywhere (sheet + emails).
    const submittedAt = new Date().toISOString();

    const resend = new Resend(process.env.RESEND_API_KEY);

    // --- 1. Emails first, so a Sheet failure never costs the lead ---
    if (!spamResult.flagged) {
      const notification = buildGreggNotification(formType, body, submittedAt);
      await resend.emails.send({
        from: 'Lead Form <noreply@realestateandloans.com>',
        to: process.env.CONTACT_NOTIFY_TO,
        subject: notification.subject,
        text: notification.text,
        replyTo: email,
      });
    }

    // Confirmation goes out either way (matches contact-form behavior).
    const confirmation = buildConfirmation(formType, body);
    await resend.emails.send({
      from: 'Gregg McElwee <noreply@realestateandloans.com>',
      to: email,
      subject: confirmation.subject,
      text: confirmation.text,
    });

    // --- 2. Sheet write last, best-effort in its own try/catch ---
    try {
      const keyJson = JSON.parse(Buffer.from(process.env.CONTACT_FORM_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
      const auth = new google.auth.GoogleAuth({
        credentials: keyJson,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = process.env.CONTACT_FORM_SHEETS_ID;

      if (spamResult.flagged) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Spam!A:G',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[submittedAt, name, email, phone || '', formType, JSON.stringify(body), spamResult.reason]],
          },
        });
      } else {
        await appendWithTabCreate(sheets, spreadsheetId, config.sheetTab, config.headers, buildRow(formType, body, submittedAt));
      }
    } catch (sheetErr) {
      console.error(`lead.js sheet write failed (${formType}), lead already emailed:`, sheetErr);
    }

    return sendJson(res, 200, { result: 'success' });

  } catch (err) {
    console.error('Lead handler error:', err);
    return sendJson(res, 500, { result: 'error', message: 'Something went wrong. Please call 949.448.0961 directly.' });
  }
}
