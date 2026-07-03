// Contact-form spam filter. Rule-based checks run first (cheap, no network);
// the AI classifier only runs when the rules are inconclusive.

const URL_PATTERN = /https?:\/\/|www\./i;

const BULK_MARKETING_PHRASES = [
  'reply stop',
  'opt out',
  'unsubscribe',
  'seo services',
  'increase your ranking',
  'boost your website traffic',
  'guaranteed results',
  'grow your business with',
  'top of google',
  'free consultation for your business',
];

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'yopmail.com',
  'trashmail.com',
  'throwawaymail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
];

const MARKETING_DOMAIN_KEYWORDS = ['marketing', 'seo', 'leads', 'growthhacking', 'outreach'];

export function checkSpamRules(formData) {
  const { website, message, email } = formData;

  if (website && website.trim()) {
    return { flagged: true, reason: 'Honeypot field was filled' };
  }

  if (message && URL_PATTERN.test(message)) {
    return { flagged: true, reason: 'Message body contains a URL' };
  }

  const lowerMessage = (message || '').toLowerCase();
  const matchedPhrase = BULK_MARKETING_PHRASES.find((phrase) => lowerMessage.includes(phrase));
  if (matchedPhrase) {
    return { flagged: true, reason: `Message contains bulk-marketing phrase: "${matchedPhrase}"` };
  }

  const domain = (email || '').split('@')[1]?.toLowerCase();
  if (domain) {
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      return { flagged: true, reason: `Sender uses a throwaway email domain: ${domain}` };
    }
    const matchedKeyword = MARKETING_DOMAIN_KEYWORDS.find((keyword) => domain.includes(keyword));
    if (matchedKeyword) {
      return { flagged: true, reason: `Sender domain looks like a marketing/lead-gen sender: ${domain}` };
    }
  }

  return null;
}

const SPAM_CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You classify inbound contact-form submissions for a real estate/mortgage broker's website. Respond with exactly two lines:
CLASSIFICATION: lead
REASON: <one short sentence>
or
CLASSIFICATION: spam
REASON: <one short sentence>`;

export async function classifyWithAI(formData) {
  const { name, email, phone, category, message } = formData;
  const apiKey = process.env.SPAM_FILTER_API_KEY;

  try {
    if (!apiKey) throw new Error('SPAM_FILTER_API_KEY is not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: SPAM_CLASSIFIER_MODEL,
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nCategory: ${category}\nMessage:\n${message}`,
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${body}`);
    }

    const data = await res.json();
    const text = data.content.map((block) => block.text ?? '').join('');

    const classificationMatch = text.match(/CLASSIFICATION:\s*(lead|spam)/i);
    const reasonMatch = text.match(/REASON:\s*(.+)/i);

    if (!classificationMatch) throw new Error(`Unexpected classifier response: ${text}`);

    return {
      flagged: classificationMatch[1].toLowerCase() === 'spam',
      reason: reasonMatch ? reasonMatch[1].trim() : 'AI classifier flagged as spam',
    };
  } catch (err) {
    // Fail open: an unavailable classifier shouldn't cost Gregg a real lead.
    console.error('classifyWithAI error:', err);
    return { flagged: false, reason: 'AI classification unavailable - defaulted to lead' };
  }
}
