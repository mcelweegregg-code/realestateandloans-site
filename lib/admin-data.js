// Data access for the admin API. Every function has a mock branch
// returning realistic fixtures so the UI can be developed and reviewed
// before Supabase credentials exist. Uses the shared isMock() so ADMIN_MOCK
// and PIPELINE_MOCK both drive it (the cron stack uses the latter).

import { getSupabaseClient } from './supabase.js';
import { isMock } from './mock.js';

const MOCK = isMock;

const mockState = {
  editorToggle: 'on',
  topics: [
    {
      id: 'mock-topic-1',
      order_index: 1,
      title: 'Why Your Real Estate Website Might Be Costing You Deals',
      description: 'A first-person post about how an outdated website signals the wrong things to potential clients, and what Gregg did about it.',
      primary_keyword: 'real estate agent website Orange County',
      guiding_questions: [
        'Have you ever lost a deal because of how you looked online? What happened?',
        'What do most agents get wrong about their web presence?',
        'What would you tell a friend who asked you why this matters?',
      ],
      category: 'buyer-seller',
      scheduled_date: '2026-06-19',
      status: 'upcoming',
    },
    {
      id: 'mock-topic-2',
      order_index: 2,
      title: 'Selling a Probate Property in Orange County: What to Expect',
      description: 'What executors need to know about timelines, court approval, and pricing.',
      primary_keyword: 'probate real estate Orange County',
      guiding_questions: [
        'What do executors usually get wrong at the start?',
        'How long does the court process really take?',
        'What does a systematic probate mailing look like?',
      ],
      category: 'probate',
      scheduled_date: '2026-06-25',
      status: 'upcoming',
    },
  ],
  pendingPosts: [
    {
      id: 'mock-post-1',
      topic_id: 'mock-topic-1',
      slug: 'real-estate-agent-website-orange-county',
      title: 'Why Your Real Estate Agent Website in Orange County Loses Deals',
      meta_title: 'Real Estate Agent Website Mistakes in Orange County',
      meta_description: 'An outdated real estate agent website in Orange County tells clients the wrong story. Gregg McElwee on what his old site cost him and what he changed.',
      primary_keyword: 'real estate agent website Orange County',
      keywords_used: ['real estate agent website Orange County'],
      image_used: null,
      body_md: "I've been selling homes in South Orange County for almost 40 years. It took me until this year to admit my website was working against me.\n\n# Why Your Real Estate Agent Website in Orange County Loses Deals\n\nI see signs pop up on streets I've worked for decades, with names I don't even recognize. Some of those deals should have been mine.\n\n## The First Impression Happens Before You Ever Meet\n\nFor most of my career, the first impression was a handshake. That world is gone.\n\n(mock draft body, truncated for fixture purposes)",
      social_linkedin: 'Almost 40 years selling homes in South Orange County, and this year I finally admitted something. My website was costing me business. (mock) [POST_URL]',
      social_facebook: 'I once paid a company to write blog posts for me. They published tips on keeping snow off your porch. I live in Southern California. So I changed it. [POST_URL]',
      craft_audit: 'CRAFT AUDIT:\n- Word count: 896 words\n- Primary keyword count: 4 instances\n- (mock audit)',
      status: 'pending_review',
      generated_at: '2026-06-12T13:02:00Z',
      rag_fallback: false,
    },
  ],
  publishedPosts: [
    { id: 'mock-pub-1', slug: 'san-clemente-real-estate-market-2026', title: 'San Clemente Real Estate Market 2026 Outlook', published_at: '2026-05-14T13:02:00Z' },
    { id: 'mock-pub-2', slug: 'selling-home-during-probate-orange-county', title: 'Selling a Home During Probate in Orange County', published_at: '2026-05-28T13:02:00Z' },
  ],
  images: [],
};

export async function getEditorToggle() {
  if (MOCK()) return mockState.editorToggle;
  const { data, error } = await getSupabaseClient()
    .from('system_config').select('value').eq('key', 'editor_toggle').single();
  if (error) throw new Error(`system_config read failed: ${error.message}`);
  return data.value;
}

export async function setEditorToggle(value) {
  if (MOCK()) { mockState.editorToggle = value; return; }
  const { error } = await getSupabaseClient()
    .from('system_config').update({ value }).eq('key', 'editor_toggle');
  if (error) throw new Error(`system_config write failed: ${error.message}`);
}

/** Next topic Gregg should record: earliest scheduled, not yet recorded/published. */
export async function getUpcomingTopic() {
  if (MOCK()) return mockState.topics[0];
  const { data, error } = await getSupabaseClient()
    .from('topics').select('*')
    .in('status', ['upcoming', 'reminder_sent', 'reminder_sent_3d', 'reminder_sent_2d', 'reminder_sent_1d'])
    .order('scheduled_date', { ascending: true })
    .limit(1);
  if (error) throw new Error(`topics read failed: ${error.message}`);
  return data[0] ?? null;
}

export async function getTopicsQueue(limit = 20) {
  if (MOCK()) return mockState.topics;
  const { data, error } = await getSupabaseClient()
    .from('topics').select('id, order_index, title, scheduled_date, status, category')
    .order('scheduled_date', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`topics read failed: ${error.message}`);
  return data;
}

export async function getPendingPosts() {
  if (MOCK()) return mockState.pendingPosts;
  const { data, error } = await getSupabaseClient()
    .from('posts').select('*').eq('status', 'pending_review')
    .order('generated_at', { ascending: false });
  if (error) throw new Error(`posts read failed: ${error.message}`);
  return data;
}

export async function getPublishedPosts(limit = 20) {
  if (MOCK()) return mockState.publishedPosts;
  const { data, error } = await getSupabaseClient()
    .from('posts').select('id, slug, title, published_at').eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`posts read failed: ${error.message}`);
  return data;
}

export async function saveVoiceMemo({ topicId, transcript }) {
  if (MOCK()) {
    const topic = mockState.topics.find((t) => t.id === topicId);
    if (topic) topic.status = 'recorded';
    return { id: 'mock-memo-1' };
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('voice_memos').insert({ topic_id: topicId, transcript }).select('id').single();
  if (error) throw new Error(`voice_memos insert failed: ${error.message}`);
  const { error: topicError } = await supabase
    .from('topics').update({ status: 'recorded' }).eq('id', topicId);
  if (topicError) throw new Error(`topic status update failed: ${topicError.message}`);
  return data;
}

export async function updatePost(id, fields) {
  if (MOCK()) {
    const post = mockState.pendingPosts.find((p) => p.id === id);
    if (post) Object.assign(post, fields);
    return;
  }
  const { error } = await getSupabaseClient().from('posts').update(fields).eq('id', id);
  if (error) throw new Error(`posts update failed: ${error.message}`);
}

export async function getPostById(id) {
  if (MOCK()) return mockState.pendingPosts.find((p) => p.id === id) ?? null;
  const { data, error } = await getSupabaseClient()
    .from('posts').select('*').eq('id', id).single();
  if (error) throw new Error(`posts read failed: ${error.message}`);
  return data;
}

export async function markTopicPublished(topicId, auto = false) {
  if (MOCK()) return;
  const { error } = await getSupabaseClient()
    .from('topics').update({ status: auto ? 'auto_generated' : 'published' }).eq('id', topicId);
  if (error) throw new Error(`topic status update failed: ${error.message}`);
}

// --------------------------------------------------- Add Content tab support

/** All existing topic titles, used to de-duplicate AI topic generation. */
export async function getAllTopicTitles() {
  if (MOCK()) return mockState.topics.map((t) => t.title);
  const { data, error } = await getSupabaseClient()
    .from('topics').select('title');
  if (error) throw new Error(`topics title read failed: ${error.message}`);
  return data.map((t) => t.title);
}

/** Topics filtered by status, ordered by scheduled_date ascending. */
export async function getTopicsByStatus(status, limit = 100) {
  if (MOCK()) {
    return mockState.topics
      .filter((t) => t.status === status)
      .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)));
  }
  const { data, error } = await getSupabaseClient()
    .from('topics').select('id, title, scheduled_date, status, order_index')
    .eq('status', status)
    .order('scheduled_date', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`topics status read failed: ${error.message}`);
  return data;
}

/** Highest order_index currently in the topics table (0 when empty). */
export async function getMaxTopicOrderIndex() {
  if (MOCK()) {
    return mockState.topics.reduce((max, t) => Math.max(max, t.order_index || 0), 0);
  }
  const { data, error } = await getSupabaseClient()
    .from('topics').select('order_index')
    .order('order_index', { ascending: false })
    .limit(1);
  if (error) throw new Error(`topics order_index read failed: ${error.message}`);
  return data.length ? (data[0].order_index || 0) : 0;
}

/**
 * Insert a single topic. Caller supplies title, description, category,
 * primary_keyword, guiding_questions (array), scheduled_date. status defaults
 * to 'upcoming'; order_index is auto-assigned as max existing + 1.
 */
export async function createTopic(fields) {
  const nextOrder = (await getMaxTopicOrderIndex()) + 1;
  const row = {
    order_index: nextOrder,
    title: fields.title,
    description: fields.description ?? null,
    primary_keyword: fields.primary_keyword ?? null,
    guiding_questions: fields.guiding_questions ?? [],
    category: fields.category ?? null,
    scheduled_date: fields.scheduled_date ?? null,
    status: 'upcoming',
  };
  if (MOCK()) {
    const saved = { id: `mock-topic-${mockState.topics.length + 1}`, ...row };
    mockState.topics.push(saved);
    return saved;
  }
  const { data, error } = await getSupabaseClient()
    .from('topics').insert(row).select('*').single();
  if (error) throw new Error(`topics insert failed: ${error.message}`);
  return data;
}

/** Insert an image library row. filename is the site-root-relative repo path. */
export async function insertImage({ filename, alt_text, category }) {
  const row = {
    filename,
    alt_text: alt_text ?? null,
    source: 'owned',
    used: false,
    category: category ?? null,
  };
  if (MOCK()) {
    const saved = { id: `mock-image-${mockState.images.length + 1}`, ...row };
    mockState.images.push(saved);
    return saved;
  }
  const { data, error } = await getSupabaseClient()
    .from('images').insert(row).select('*').single();
  if (error) throw new Error(`images insert failed: ${error.message}`);
  return data;
}

/** Set the alt_text on an existing image row (used after vision generation). */
export async function updateImageAltText(id, altText) {
  if (MOCK()) {
    const img = mockState.images.find((i) => i.id === id);
    if (img) img.alt_text = altText;
    return;
  }
  const { error } = await getSupabaseClient()
    .from('images').update({ alt_text: altText }).eq('id', id);
  if (error) throw new Error(`images alt_text update failed: ${error.message}`);
}
