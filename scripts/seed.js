// Seed Supabase tables from JSON files. Validates input before touching
// the database; --dry-run validates and prints without connecting.
//
// Usage:
//   node scripts/seed.js topics content/seed/topics.json --start-date 2026-07-02 [--dry-run]
//   node scripts/seed.js keywords content/seed/keywords.json [--dry-run]
//
// Topic scheduling: topic with order_index 1 publishes on --start-date,
// each subsequent topic 6 days after the previous (start + (order_index - 1) * 6).

import { readFileSync, existsSync } from 'node:fs';

const CATEGORIES = ['probate', 'divorce', 'market', 'community', 'buyer-seller', 'local'];
const PUBLISH_INTERVAL_DAYS = 6;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((a) => !a.startsWith('--'));
const [table, inputFile] = positional;
const startDateArg = args.includes('--start-date') ? args[args.indexOf('--start-date') + 1] : null;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

if (!['topics', 'keywords'].includes(table)) {
  fail('first argument must be "topics" or "keywords"');
}
if (!inputFile || !existsSync(inputFile)) {
  fail(`input file not found: ${inputFile}`);
}

// Strip a UTF-8 BOM if present; Windows editors and PowerShell add one.
const rows = JSON.parse(readFileSync(inputFile, 'utf8').replace(/^﻿/, ''));
if (!Array.isArray(rows) || rows.length === 0) {
  fail('input file must be a non-empty JSON array');
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function validateTopics() {
  if (!startDateArg) fail('topics seeding requires --start-date YYYY-MM-DD');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateArg)) fail('--start-date must be YYYY-MM-DD');

  const seenIndexes = new Set();
  return rows.map((row, i) => {
    const where = `topics[${i}] (${row.title || 'untitled'})`;
    if (!Number.isInteger(row.order_index) || row.order_index < 1) {
      fail(`${where}: order_index must be a positive integer`);
    }
    if (seenIndexes.has(row.order_index)) fail(`${where}: duplicate order_index ${row.order_index}`);
    seenIndexes.add(row.order_index);
    if (!row.title) fail(`${where}: title is required`);
    if (!row.description) fail(`${where}: description is required`);
    if (!row.primary_keyword) fail(`${where}: primary_keyword is required`);
    if (!Array.isArray(row.guiding_questions) || row.guiding_questions.length < 3 || row.guiding_questions.length > 4) {
      fail(`${where}: guiding_questions must be an array of 3-4 strings`);
    }
    if (!CATEGORIES.includes(row.category)) {
      fail(`${where}: category must be one of ${CATEGORIES.join(', ')}`);
    }
    return {
      order_index: row.order_index,
      title: row.title,
      description: row.description,
      primary_keyword: row.primary_keyword,
      guiding_questions: row.guiding_questions,
      category: row.category,
      scheduled_date: addDays(startDateArg, (row.order_index - 1) * PUBLISH_INTERVAL_DAYS),
      status: 'upcoming',
    };
  });
}

function validateKeywords() {
  const seen = new Set();
  return rows.map((row, i) => {
    const where = `keywords[${i}]`;
    if (!row.keyword) fail(`${where}: keyword is required`);
    if (seen.has(row.keyword)) fail(`${where}: duplicate keyword "${row.keyword}"`);
    seen.add(row.keyword);
    if (!Array.isArray(row.topic_tags) || row.topic_tags.length === 0) {
      fail(`${where} ("${row.keyword}"): topic_tags must be a non-empty array`);
    }
    const badTags = row.topic_tags.filter((t) => !CATEGORIES.includes(t));
    if (badTags.length > 0) {
      fail(`${where} ("${row.keyword}"): unknown topic_tags ${badTags.join(', ')}`);
    }
    const priority = row.priority ?? 3;
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      fail(`${where} ("${row.keyword}"): priority must be an integer 1-5`);
    }
    return { keyword: row.keyword, topic_tags: row.topic_tags, priority };
  });
}

const validated = table === 'topics' ? validateTopics() : validateKeywords();
console.log(`validated ${validated.length} ${table} rows from ${inputFile}`);

if (dryRun) {
  for (const row of validated) {
    const label = table === 'topics'
      ? `#${String(row.order_index).padStart(3, ' ')} ${row.scheduled_date} [${row.category}] ${row.title}`
      : `[${row.topic_tags.join(', ')}] (p${row.priority}) ${row.keyword}`;
    console.log(`  ${label}`);
  }
  console.log('dry run: no database writes');
  process.exit(0);
}

try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on the environment
}

const { getSupabaseClient } = await import('../lib/supabase.js');
const supabase = getSupabaseClient();
const conflictKey = table === 'topics' ? 'order_index' : 'keyword';
const { error } = await supabase.from(table).upsert(validated, { onConflict: conflictKey });
if (error) fail(`supabase upsert failed: ${error.message}`);
console.log(`upserted ${validated.length} rows into ${table} (conflict key: ${conflictKey})`);
