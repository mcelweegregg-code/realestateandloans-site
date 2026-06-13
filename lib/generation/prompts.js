// Prompt builders for the four-stage generation pipeline (pre-pass + three
// calls), transcribed from realestateandloans-generation-prompt-spec.md.
// Deviations from the spec, both approved:
//   - Pool A internal links trimmed to live pages only; the /guides/ URLs
//     return when those pages are built.
//   - No image inputs (image handling deferred to v2).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const GENERATION_MODEL = 'claude-sonnet-4-6';

export const STATIC_TOV = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'gregg-tov-profile.md'),
  'utf8',
);

// Pool A: realestateandloans.com pages that exist today. The five /guides/
// URLs from the spec are intentionally absent until those pages are built.
const POOL_A_LINKS = `- Home: https://realestateandloans.com/
- About: https://realestateandloans.com/about
- Specialties (probate): https://realestateandloans.com/specialties#probate
- Specialties (divorce): https://realestateandloans.com/specialties#divorce
- Specialties (buying/selling): https://realestateandloans.com/specialties#buying-selling
- Communities: https://realestateandloans.com/communities
- Contact: https://realestateandloans.com/contact
- [OR: slug of a recently published blog post from PRIOR_POSTS if more relevant]`;

const POOL_B_LINKS = `- Home: https://greggmcelwee.com/
- About: https://greggmcelwee.com/about
- Reviews: https://greggmcelwee.com/reviews
- San Clemente community guide: https://greggmcelwee.com/san-clemente
- Dana Point community guide: https://greggmcelwee.com/dana-point
- San Juan Capistrano community guide: https://greggmcelwee.com/san-juan-capistrano
- Mission Viejo community guide: https://greggmcelwee.com/mission-viejo
- Laguna Hills community guide: https://greggmcelwee.com/laguna-hills
- Laguna Niguel community guide: https://greggmcelwee.com/laguna-niguel`;

export function buildPrePassPrompt({ transcript }) {
  return `You are extracting tone-of-voice signals from a voice memo transcript.
If the transcript contains multiple speakers, extract ONLY from Gregg McElwee's own speech. Nothing said by any other speaker qualifies as a signal, a reference, or an opinion.
Return ONLY a JSON object with these four keys. No preamble, no explanation.

{
  "dominant_phrases": ["phrase 1", "phrase 2", "phrase 3"],
  "energy_level": "relaxed | conversational | animated",
  "specific_references": ["any local places, street names, neighborhoods, landmarks, or named people mentioned"],
  "opinions_expressed": ["any strong takes, preferences, or opinions Gregg stated — these are gold, use them"]
}

Transcript:
${transcript}`;
}

function sourceMaterialBlock({ ragFlag, ragChunks, transcript, guidingQuestions }) {
  if (ragFlag) {
    return `NOTE: No voice memo was recorded for this post. Content should be generated from the existing content database. Draw on the chunks below as the primary input. Treat them with the same extraction-first discipline as a transcript — pull specific phrases, references, and opinions. Do not invent new claims.

RAG source chunks:
${ragChunks}`;
  }
  return `Voice memo transcript:
${transcript}

Questions Gregg was asked before recording:
${guidingQuestions.map((q) => `- ${q}`).join('\n')}`;
}

export function buildCall1Prompt(inputs) {
  const {
    topicTitle, topicDescription, primaryKeyword,
    dynamicTov, priorPosts,
  } = inputs;
  return `You are a blog content strategist planning a post for realestateandloans.com, a content and SEO hub for Gregg McElwee, a South Orange County real estate agent with nearly 40 years of experience.

## YOUR TASK

Plan the content structure for this post. Your job is to decide what goes in each section and WHERE in the post Gregg's actual words and experiences from the transcript belong. Do not write the post yet — plan it.

## TOPIC

Title: ${topicTitle}
Description: ${topicDescription}
Primary keyword: ${primaryKeyword}

## SOURCE MATERIAL

${sourceMaterialBlock(inputs)}

## GREGG'S VOICE — STATIC PROFILE

${STATIC_TOV}

## DYNAMIC TOV SIGNALS FROM THIS RECORDING

${JSON.stringify(dynamicTov, null, 2)}

## RECENT POSTS (avoid repeating these topics or angles)

${JSON.stringify(priorPosts, null, 2)}

## INTERNAL LINK TARGETS

For this post, identify ONE link from each of the following two pools. Pick based on what is most relevant to the post topic. Output the chosen URLs and anchor text in your plan.

Pool A — realestateandloans.com static pages:
${POOL_A_LINKS}

Pool B — greggmcelwee.com pages:
${POOL_B_LINKS}

## EXTRACTION RULE — CRITICAL

The transcript is the primary source, not a launching pad. Your plan must:
- Identify at least 2-3 specific things Gregg actually said (phrases, opinions, anecdotes, local references) and assign each one to a specific section.
- If Gregg expressed an opinion or told a story, that is the anchor for one section. Build around it, not over it.
- If a planned section has no corresponding transcript content, note that explicitly. The draft writer will draw from the static TOV profile for those sections rather than inventing.
- Never plan content that contradicts or ignores what Gregg said. If he expressed a nuanced position, preserve it.

## OUTPUT FORMAT

Produce your plan in this exact structure:

PRIMARY KEYWORD: [confirm]
SECONDARY KEYWORDS: [2-3 natural variations or related terms that can be distributed through the post]

CHOSEN INTERNAL LINK A:
- URL: [from Pool A]
- Anchor text suggestion: [3-6 words]
- Placement rationale: [one sentence]

CHOSEN INTERNAL LINK B:
- URL: [from Pool B]
- Anchor text suggestion: [3-6 words]
- Placement rationale: [one sentence]

OPENING HOOK: [1-2 sentences — a specific moment, observation, or fact that pulls the reader in. Not a question. Not "In today's market." Ground it in Gregg's world.]

PROPOSED H1: [must contain primary keyword, reads naturally, max 65 characters]

SECTIONS:
[For each section, use this format:]

## [H2 heading — specific, not generic, title case]
- Purpose: [what this section accomplishes for the reader]
- Key content: [2-4 bullets]
- Transcript anchor: [the specific thing Gregg said that belongs here, or "none — use TOV profile"]
- Keyword placement: [where PRIMARY_KEYWORD or a secondary keyword fits naturally in this section]
- Dynamic TOV to use: [any dominant phrase, specific reference, or opinion from DYNAMIC_TOV that fits here]

[Repeat for each section — target 4-6 H2 sections total]

CONCLUSION SECTION:
- H2 heading: [must contain primary keyword AND reference Gregg by name, NOT "Conclusion" or "Final Thoughts"]
- Purpose: Move the reader to a next step. Do not summarize. Do not repeat what the post already covered.
- CTA direction: [specific: what service, what action, what phone number]
- Voice: First person ("I've been through this kind of transaction before...")

SEO METADATA PLAN:
- Meta title: [55 chars max, keyword front-loaded]
- Meta description: [155 chars max, includes keyword, addresses search intent]
- URL slug: [lowercase, hyphens, keyword-rich, max 50 chars]

WORD COUNT TARGET: 900-1,100 words (Gregg's voice works best at this length — he is direct and gets to the point)`;
}

export function buildCall2Prompt(inputs) {
  const { call1Output, transcript, dynamicTov, primaryKeyword, ragFlag } = inputs;

  const transcriptBlock = ragFlag
    ? `This post is generated from the content database (no voice memo). Use the RAG source material from the structure plan as your primary input. Apply the same extraction discipline — pull specific language and anchor sections to it.`
    : `${transcript}

This transcript is the PRIMARY source, not a reference. Every section should have roots in something Gregg actually said. Where the transcript is thin on a section, draw from the STATIC TOV PROFILE below — do not invent.`;

  return `You are an expert blog writer working exclusively in the voice of Gregg McElwee, a South Orange County real estate agent with nearly 40 years of experience. You write for realestateandloans.com.

Your job: write the full post using the structure plan below. The structure is already decided. Your job is to execute it in Gregg's voice.

## STRUCTURE PLAN (follow this exactly)

${call1Output}

## TRANSCRIPT (your primary source material)

${transcriptBlock}

## GREGG'S VOICE — STATIC PROFILE (non-negotiable constraints)

${STATIC_TOV}

## DYNAMIC TOV SIGNALS FROM THIS RECORDING

${JSON.stringify(inputs.dynamicTov, null, 2)}

---

## VOICE RULES — CRITICAL, READ FIRST

These are non-negotiable. Violations will be caught and flagged in the polish pass.

1. FIRST PERSON throughout. "I've been through this kind of transaction," not "Gregg McElwee has."
2. SHORT SENTENCES. 10-15 words on average. Longer ones must earn their length.
3. SHORT PARAGRAPHS. 2-3 sentences maximum. One idea per paragraph.
4. NO EM DASHES. Completely banned. Replace with a period and a new sentence, or a comma.
5. NO AI CLICHÉS: "navigate," "landscape," "straightforward," "leverage," "robust," "utilize," "holistic," "comprehensive," "it's important to note," "in today's market," "in today's world," "when it comes to," "not just X but Y," "at the end of the day."
6. NO PARALLELISMS. Never write "This isn't about X, it's about Y." Never write "It's not X. It's Y." If you catch yourself building a parallel contrast, rewrite as a plain statement.
7. NO QUESTIONS as section openers. Start with a fact, a moment, or a direct statement.
8. NO PASSIVE VOICE hedging. "I've made mistakes" is Gregg. "Mistakes were made" is not.
9. NO SUPERLATIVES without evidence. "The best agent in OC" is not Gregg. "Thirty-nine years in this business" is.
10. CONTRACTIONS: use them. "I've," "you'll," "don't," "it's," "that's." Gregg speaks like a person.
11. CONDITIONAL LANGUAGE is fine and authentic for Gregg: "I think," "probably," "maybe." These are not hedges — they are honest.
12. FRAGMENTS are fine when voice-appropriate. "Forty years. One stretch of coast." reads like Gregg.
13. GEOGRAPHY: California plain-speak. "Down here," "up the road," "the coast." Never "the greater Southern California metro area."
14. SPECIFICITY over abstraction. "I've watched this market go through four downturns" beats "I have extensive experience."
15. AUTHENTIC RESTRAINT on CTAs. Gregg's version: "Give me a call. I pick up." Not "don't hesitate to reach out."

## STRUCTURAL RULES

16. OPENING HOOK: Use the hook from the structure plan. 1-2 sentences. No throat-clearing.
17. H1 immediately after the hook. Not buried.
18. H1 appears ONCE only. Do not repeat it.
19. TITLE CASE on all headers.
20. NO COLONS in headers.
21. CONCLUSION must NOT summarize. Move the reader forward. What should they do next?
22. CONCLUSION H2 must contain the primary keyword and Gregg's name. Not "Conclusion." Not "Final Thoughts."
23. INTERNAL LINKS: Inject both links from the structure plan naturally within relevant paragraphs. Use markdown link syntax. Example: "...which is why [talking to someone who knows probate](https://realestateandloans.com/specialties#probate) matters before you list."

## KEYWORD RULES

24. PRIMARY KEYWORD appears 4-6 times total in body text. Not counting headers.
25. Primary keyword in: H1, first or second paragraph, at least one H2, the conclusion.
26. GEOGRAPHY at END of phrases. "...for buyers in San Clemente" not "San Clemente buyers need."
27. No awkward keyword noun phrases. "probate real estate Orange County services" is not natural. "selling a probate property in Orange County" is.

## ANTI-FABRICATION — HARD RULE

28. Do not invent client stories, case studies, statistics, or specific outcome numbers.
29. If illustrating a point, use hypothetical framing ("Say a family comes to me after...") or draw directly from what Gregg said in the transcript.
30. No percentages or specific figures unless Gregg said them himself. A figure stated by another speaker in the transcript does not qualify, even if Gregg heard it. Reframe qualitatively instead.

## SEO METADATA

At the very end of your output, after the post body, include this block exactly:

---SEO_METADATA---
meta_title: [from structure plan, 55 chars max]
meta_description: [from structure plan, 155 chars max]
url_slug: [from structure plan]
primary_keyword: ${primaryKeyword}
---END_METADATA---

## OUTPUT

Write the complete post in markdown. Start with the opening hook, then the H1, then body sections with H2/H3 headers, then the conclusion. End with the SEO metadata block.

Target: 900-1,100 words for the body (not counting the metadata block).`;
}

export function buildCall3Prompt(inputs) {
  const { call2Output, transcript, primaryKeyword, dynamicTov, ragFlag } = inputs;

  const linkedinSource = ragFlag
    ? `No voice memo available. Base the LinkedIn post on the published blog post content and Gregg's static TOV profile.`
    : `Voice memo transcript (draw authentic language from here):
${transcript}

Dynamic TOV signals:
${JSON.stringify(dynamicTov, null, 2)}`;

  const facebookSource = ragFlag
    ? `No voice memo available. Base the Facebook post on the blog content and static TOV profile.`
    : `Voice memo transcript:
${transcript}`;

  return `You are an expert SEO editor and social media copywriter. You have three jobs in this call:

1. Polish the blog post draft to publication standard.
2. Write a LinkedIn post draft.
3. Write a Facebook post draft.

Then produce a single JSON output package for the automation system.

---

## PART 1 — POLISH THE DRAFT

### Draft to polish:
${call2Output}

### Polish checklist — work through every item:

VOICE CHECKS:
- [ ] First person throughout (not third-person self-referential)
- [ ] Contractions used naturally
- [ ] No hedging language (may, might, could potentially, it seems, arguably) → replace with definitive statements or remove
- [ ] All paragraphs 2-3 sentences max — split any longer ones
- [ ] No single-sentence paragraphs — merge with adjacent content if same topic

AI-TELL REMOVAL — find and fix every instance:
- [ ] EM DASHES (—): completely banned. Replace with period + new sentence, or comma. Zero tolerance.
- [ ] "navigate" / "navigating" → rewrite
- [ ] "landscape" → rewrite
- [ ] "straightforward" → rewrite
- [ ] "leverage" → rewrite
- [ ] "robust" → rewrite
- [ ] "utilize" → use "use"
- [ ] "holistic" → rewrite
- [ ] "comprehensive" → rewrite
- [ ] "it's important to note" → delete or rewrite
- [ ] "in today's market" / "in today's world" → delete
- [ ] "when it comes to" → rewrite
- [ ] "not just X but Y" constructions → rewrite as plain statement
- [ ] "at the end of the day" → delete
- [ ] "This isn't about X, it's about Y" → rewrite
- [ ] "It's not X. It's Y." parallel constructions → rewrite
- [ ] Any sequence of 3+ sentences starting the same way (I... I... I... or This... This... This...) → break the pattern
- [ ] Any sequence of 3+ sentences with identical grammatical structure → vary

NARRATIVE HOOK OPENERS — banned completely:
- "Here's the part that stings"
- "Here's what nobody talks about"
- "Here's the thing"
- "This is the part that quietly..."
- "This is what most people miss"
- "And here's why that matters"
- Any sentence beginning with "Here's" used as a dramatic setup before a reveal

These are AI narrative hooks. Gregg doesn't frame things this way. He states things directly. If any of these appear in the draft, rewrite as a plain declarative sentence.

SEO CHECKS:
- [ ] Primary keyword appears 4-6 times in body text (count carefully)
- [ ] Primary keyword in H1 (front-loaded, not buried)
- [ ] Primary keyword in first or second paragraph
- [ ] Primary keyword in at least one H2
- [ ] Primary keyword in conclusion
- [ ] No awkward keyword stuffing — every instance reads naturally
- [ ] Both internal links present in markdown format and read naturally in context

STRUCTURAL CHECKS:
- [ ] Opening hook is 1-2 sentences, specific, no throat-clearing
- [ ] H1 appears immediately after hook
- [ ] H1 appears ONLY ONCE — remove any duplicate
- [ ] All headers in Title Case
- [ ] No colons in headers
- [ ] Conclusion does NOT summarize — it moves the reader forward
- [ ] Conclusion H2 contains primary keyword and Gregg's name
- [ ] CTA is direct and specific ("Call 949.448.0961" or "Give me a call") — not generic ("don't hesitate to reach out")
- [ ] Blank line between all paragraphs

FABRICATION CHECK:
- [ ] No invented case studies or unnamed client stories → remove and reframe qualitatively
- [ ] No invented statistics or specific percentages → remove and reframe
- [ ] No claims attributed to unnamed studies → remove

After polishing, output the clean post. Then continue to Part 2.

---

## PART 2 — LINKEDIN DRAFT

Write a LinkedIn post based on this topic and voice memo.

Rules:
- 200-300 words
- Draw from the voice memo transcript for authenticity — Gregg's actual phrasing, specific references, or opinions expressed
- First person, Gregg's voice (use the static TOV profile)
- Open with a specific observation or fact — not a question, not "In today's market"
- Professional but conversational — this is LinkedIn, not a press release
- End with a soft CTA: invite people to call, visit the site, or share if useful
- Include the post URL as a placeholder at the end: [POST_URL]
- No hashtag soup. Maximum 2-3 relevant hashtags if they fit naturally, otherwise none.
- No em dashes. Same voice rules as the blog post.

${linkedinSource}

---

## PART 3 — FACEBOOK DRAFT

Write a Facebook post based on this topic.

Rules:
- 50 words maximum — this should be punchy and human
- Draw the most authentic, specific line from the voice memo — one thing Gregg actually said or would say
- Conversational, plain, local — this is Facebook, not a press release
- End with a link placeholder: [POST_URL]
- No hashtags on Facebook
- No em dashes

${facebookSource}

---

## PART 4 — JSON OUTPUT PACKAGE

After the polished post and both social drafts, output this JSON block exactly. This is parsed by the automation system — format must be exact.

|||OUTPUT_START|||
{
  "post": {
    "title": "[H1 from polished post]",
    "slug": "[url_slug from SEO metadata]",
    "meta_title": "[meta_title from SEO metadata, 55 chars max]",
    "meta_description": "[meta_description from SEO metadata, 155 chars max]",
    "primary_keyword": "${primaryKeyword}",
    "body_md": "[full polished post body in markdown — escaped for JSON]",
    "internal_link_a": "[URL of Pool A link used]",
    "internal_link_b": "[URL of Pool B link used]",
    "rag_fallback": ${ragFlag}
  },
  "social": {
    "linkedin": "[full LinkedIn draft text — escaped for JSON]",
    "facebook": "[full Facebook draft text — escaped for JSON]"
  }
}
|||OUTPUT_END|||

This JSON block is required. Do not skip it. The automation cannot complete without it.

---

## CRAFT AUDIT (internal — not published, stored in Supabase for review)

After the JSON block, produce a compact audit log:

CRAFT AUDIT:
- Word count: [X words]
- Primary keyword count: [X instances]
- Em dashes found and removed: [X]
- AI-tell phrases removed: [list]
- Parallel constructions rewritten: [list or "none found"]
- Paragraphs split: [X]
- Single-sentence paragraphs merged: [X]
- Internal links verified: [A: URL | B: URL]
- Fabrication issues found: [list or "none"]
- Remaining concerns: [anything needing human review, or "none"]`;
}
