/**
 * =============================================================
 * contact-form-handler.gs
 * Backend for the contact form on realestateandloans.com.
 *
 * Receives a POST from the site's contact form, validates it,
 * rate-limits per email, writes the submission to a Google
 * Sheet, emails Gregg, and sends the submitter an auto-reply.
 *
 * No external libraries. Apps Script built-ins only.
 * =============================================================
 */

/*
 * DEPLOYMENT INSTRUCTIONS
 *
 * 1. In Gregg's Google account, go to sheets.google.com and create a new blank sheet.
 *    Name it: realestateandloans.com - Contact Forms
 *
 * 2. Inside that sheet, go to Extensions > Apps Script.
 *    This opens a container-bound script editor tied to the sheet.
 *
 * 3. Delete the default placeholder code and paste the entire contents of this file in.
 *
 * 4. Save the project. Name it something like: realestateandloans Contact Form
 *
 * 5. Click Deploy > New deployment > Web app.
 *    Set "Execute as": Me (Gregg's Google account)
 *    Set "Who has access": Anyone
 *    Click Deploy and copy the deployment URL.
 *
 * 6. In contact.html, replace APPS_SCRIPT_URL_PLACEHOLDER with the deployment URL.
 *
 * 7. Every time this script is edited, click Deploy > Manage deployments,
 *    then edit the existing deployment rather than creating a new one.
 *    Creating a new deployment changes the URL and breaks the form.
 */

/* -------------------------------------------------------------
 * CONFIGURATION
 * All settings live here so they are easy to find and update.
 * ----------------------------------------------------------- */
const CONFIG = {
  SHEET_NAME: 'Form Submissions',
  GREGG_EMAIL: 'Gregg@realestateandloans.com',
  RATE_LIMIT_COUNT: 3,
  RATE_LIMIT_WINDOW_MS: 10 * 60 * 1000
};

/* Header row written to the sheet on first run. */
const SHEET_HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Phone',
  'Category',
  'Message',
  'Submitted At'
];

/**
 * GET handler. No-op so hitting the deployment URL directly in a
 * browser returns a clean response instead of an error.
 */
function doGet(e) {
  return ContentService.createTextOutput('OK');
}

/**
 * POST handler. This is the entry point the contact form calls.
 * The entire body is wrapped in try/catch so the function always
 * returns parseable JSON, never an HTML 500 error page that the
 * client's fetch() handler could not read.
 */
function doPost(e) {
  try {
    /* --- 1. Parse the incoming JSON payload ----------------- */
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        result: 'error',
        message: 'Something went wrong. Please call 949.448.0961 directly.'
      });
    }

    var data = JSON.parse(e.postData.contents);

    var name = (data.name || '').toString().trim();
    var email = (data.email || '').toString().trim();
    var phone = (data.phone || '').toString().trim();
    var category = (data.category || '').toString().trim();
    var message = (data.message || '').toString().trim();
    var timestamp = (data.timestamp || '').toString().trim();

    /* --- 2. Validate required fields ------------------------ */
    if (!name || !email || !message || !category) {
      return jsonResponse({
        result: 'error',
        message: 'Please complete all required fields.'
      });
    }

    /* --- 3. Rate limit by email ----------------------------- */
    if (isRateLimited(email)) {
      return jsonResponse({
        result: 'error',
        message: 'Too many submissions. Please try again later or call 949.448.0961 directly.'
      });
    }

    /* --- 4. Append the submission to the sheet -------------- */
    appendSubmission({
      timestamp: timestamp,
      name: name,
      email: email,
      phone: phone,
      category: category,
      message: message
    });

    /* --- 5. Notify Gregg ------------------------------------ */
    sendGreggNotification(name, email, phone, category, message, timestamp);

    /* --- 6. Auto-reply to the submitter --------------------- */
    sendSenderConfirmation(name, email);

    /* --- 7. Success ----------------------------------------- */
    return jsonResponse({ result: 'success' });

  } catch (err) {
    /* Any uncaught error lands here so the client still gets
       JSON it can parse. */
    console.error('contact-form-handler doPost error: ' + err);
    return jsonResponse({
      result: 'error',
      message: 'Something went wrong. Please call 949.448.0961 directly.'
    });
  }
}

/* -------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------- */

/**
 * Builds a JSON TextOutput. Setting the JSON mime type is what
 * lets the browser read the response without it being blocked.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns true if this email has submitted at least
 * RATE_LIMIT_COUNT times within RATE_LIMIT_WINDOW_MS.
 *
 * Storage uses PropertiesService (fast, no sheet writes):
 *   key   = "rl_" + lowercased email
 *   value = JSON array of ISO timestamp strings
 *
 * Old entries are filtered out on every call. When under the
 * limit, the current time is recorded and saved back.
 */
function isRateLimited(email) {
  var props = PropertiesService.getScriptProperties();
  var key = 'rl_' + email.toLowerCase();
  var now = Date.now();

  var recent = [];
  var stored = props.getProperty(key);
  if (stored) {
    try {
      recent = JSON.parse(stored);
    } catch (parseErr) {
      recent = [];
    }
  }

  /* Keep only timestamps still inside the window. */
  recent = recent.filter(function (iso) {
    var t = new Date(iso).getTime();
    return !isNaN(t) && (now - t) < CONFIG.RATE_LIMIT_WINDOW_MS;
  });

  /* Already at or over the limit, reject without recording. */
  if (recent.length >= CONFIG.RATE_LIMIT_COUNT) {
    props.setProperty(key, JSON.stringify(recent));
    return true;
  }

  /* Under the limit: record this submission and allow it. */
  recent.push(new Date(now).toISOString());
  props.setProperty(key, JSON.stringify(recent));
  return false;
}

/**
 * Appends one submission row to the sheet, creating the sheet
 * tab and header row if they do not exist yet.
 */
function appendSubmission(sub) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  /* First run: create the tab and write the header row. */
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(SHEET_HEADERS);
  }

  /* Server-side timestamp for audit, independent of the
     client-supplied timestamp. */
  var submittedAt = new Date();

  sheet.appendRow([
    sub.timestamp,
    sub.name,
    sub.email,
    sub.phone,
    sub.category,
    sub.message,
    submittedAt
  ]);
}

/**
 * Emails Gregg with the details of a new submission.
 */
function sendGreggNotification(name, email, phone, category, message, timestamp) {
  var subject = 'New contact form submission, ' + category + ' from ' + name;

  var body =
    'You have a new contact form submission from realestateandloans.com.\n\n' +
    'Name: ' + name + '\n' +
    'Email: ' + email + '\n' +
    'Phone: ' + (phone ? phone : 'Not provided') + '\n' +
    'Category: ' + category + '\n' +
    'Message:\n' + message + '\n\n' +
    'Submitted: ' + timestamp + '\n';

  MailApp.sendEmail({
    to: CONFIG.GREGG_EMAIL,
    subject: subject,
    body: body,
    replyTo: email
  });
}

/**
 * Sends the submitter a plain-text confirmation. Greets them by
 * first name only, split from the full name field.
 */
function sendSenderConfirmation(name, email) {
  var firstName = name.split(/\s+/)[0];

  var subject = 'Got your message | Gregg McElwee, Real Estate & Loans';

  var body =
    'Hi ' + firstName + ',\n\n' +
    'Thanks for reaching out. Your message came through and Gregg will be in touch shortly.\n\n' +
    'If you need to reach him directly in the meantime:\n' +
    'Phone: (949) 448-0961\n' +
    'Email: Gregg@realestateandloans.com\n\n' +
    'Talk soon,\n' +
    'Gregg McElwee\n' +
    'Real Estate & Loans\n' +
    'San Clemente, California\n' +
    'realestateandloans.com\n';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    replyTo: CONFIG.GREGG_EMAIL
  });
}
