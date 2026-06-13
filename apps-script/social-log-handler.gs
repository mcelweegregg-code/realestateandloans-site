/**
 * =============================================================
 * social-log-handler.gs
 * Social post log webhook for the autoblog pipeline.
 *
 * Receives a POST from the publish flow when a blog post goes
 * live and appends one row to the "Social Posts" tab of the
 * shared sheet. Columns A-E are written by the system; columns
 * F-G are manual checkboxes Gregg ticks after posting.
 *
 * No external libraries. Apps Script built-ins only.
 * =============================================================
 */

/*
 * DEPLOYMENT INSTRUCTIONS
 *
 * 1. Open the existing shared sheet (the one with the contact form
 *    submissions, or the shared social sheet if separate).
 *
 * 2. Extensions > Apps Script. Add a NEW script file alongside the
 *    contact form handler? NO — Apps Script web apps route all POSTs
 *    through a single doPost. Instead, create a SEPARATE Apps Script
 *    project bound to the sheet that holds the "Social Posts" tab
 *    (Extensions > Apps Script from that sheet), and paste this file in.
 *
 * 3. Set the shared secret: Project Settings > Script Properties >
 *    add property WEBHOOK_SECRET with a long random value. Put the
 *    same value in Vercel/.env as SHEETS_WEBHOOK_SECRET.
 *
 * 4. Deploy > New deployment > Web app.
 *    "Execute as": Me. "Who has access": Anyone.
 *    Copy the deployment URL into Vercel/.env as SHEETS_WEBHOOK_URL.
 *
 * 5. When editing later, update the EXISTING deployment (Deploy >
 *    Manage deployments) so the URL stays stable.
 */

var SOCIAL_CONFIG = {
  SHEET_NAME: 'Social Posts'
};

var SOCIAL_HEADERS = [
  'Publish Date',
  'Topic',
  'Post URL',
  'LinkedIn Draft',
  'Facebook Draft',
  'Posted (LinkedIn)',
  'Posted (Facebook)'
];

function doGet(e) {
  return ContentService.createTextOutput('OK');
}

/**
 * POST handler. Expects JSON:
 * { "secret": "...", "type": "social_log",
 *   "row": { publish_date, topic, post_url, linkedin_draft, facebook_draft } }
 *
 * Always returns JSON. The publish flow checks for {"ok":true}.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return socialJsonResponse({ ok: false, error: 'empty request' });
    }

    var data = JSON.parse(e.postData.contents);

    /* Shared-secret check so random POSTs to the public URL do nothing. */
    var expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!expected || data.secret !== expected) {
      return socialJsonResponse({ ok: false, error: 'unauthorized' });
    }

    if (data.type !== 'social_log' || !data.row) {
      return socialJsonResponse({ ok: false, error: 'unknown payload type' });
    }

    var row = data.row;
    if (!row.publish_date || !row.topic || !row.post_url) {
      return socialJsonResponse({ ok: false, error: 'missing required row fields' });
    }

    appendSocialRow(row);
    return socialJsonResponse({ ok: true });

  } catch (err) {
    console.error('social-log-handler doPost error: ' + err);
    return socialJsonResponse({ ok: false, error: 'internal error' });
  }
}

function socialJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Appends one social log row, creating the tab with headers and
 * checkbox columns on first run. Columns F and G get real checkbox
 * data validation so Gregg can tick them.
 */
function appendSocialRow(row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SOCIAL_CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SOCIAL_CONFIG.SHEET_NAME);
    sheet.appendRow(SOCIAL_HEADERS);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    row.publish_date,
    row.topic,
    row.post_url,
    row.linkedin_draft,
    row.facebook_draft,
    false,
    false
  ]);

  /* Turn the two false cells just written into real checkboxes. */
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 6, 1, 2).insertCheckboxes();
}
