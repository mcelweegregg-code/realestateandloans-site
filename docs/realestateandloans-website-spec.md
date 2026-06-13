# realestateandloans.com Website Spec

Complete build specification for Claude Code. This document contains every decision, design token, content direction, and technical requirement needed to build the site from scratch.

---

## Strategic context

Gregg McElwee operates two domains. This spec covers realestateandloans.com only.

**greggmcelwee.com** (already live) is the personal brand site. It sells Gregg as a person: warm design, community guides with deep local content, client reviews, mortgage calculator. Cream/warm palette, Playfair-inspired typography.

**realestateandloans.com** (this build) is the content and expertise hub. It has a 27-year-old domain (created June 1999), 73 backlinks from directory listings, and Domain Authority 13. This site drives organic search traffic through blog content, specialty pages (probate, divorce, estate transitions), and educational resources, then funnels visitors to Gregg for the personal credibility close.

The two sites cross-link strategically. They must look and feel like related but distinct properties, not copies of each other.

---

## Deployment

- **Platform:** GitHub Pages
- **Repo:** `realestateandloans-site` under Gregg's GitHub account
- **Build approach:** Plain HTML/CSS/JS. No framework, no build step, no dependencies
- **Custom domain:** realestateandloans.com (DNS cutover handled separately per the migration plan)
- **HTTPS:** Enforced via GitHub Pages / Let's Encrypt

---

## Design system

### Color palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--navy` | `#1b2a4a` | Primary accent. Hero backgrounds, headings on light backgrounds, footer background |
| `--gold` | `#c8963e` | Secondary accent. CTAs, hover states, hero headline, highlights |
| `--white` | `#ffffff` | Page background, card backgrounds |
| `--light-gray` | `#f7f7f5` | Alternate section backgrounds (every other section on long pages) |
| `--text-primary` | `#1b2a4a` | Body headings (same as navy) |
| `--text-body` | `#3a3a3a` | Body text |
| `--text-muted` | `#6b6b6b` | Captions, meta text, secondary labels |
| `--border` | `#e2e2e0` | Card borders, dividers |

This palette is deliberately cooler and more structured than greggmcelwee.com's warm cream (#f5efe4) to create visual distinction between the two sites.

### Typography

**Self-hosted fonts. No Google Fonts CDN.** Download .woff2 files into `/assets/fonts/` and load via `@font-face` declarations.

| Role | Font | Weight | Fallback stack |
|------|------|--------|----------------|
| Headlines (h1, h2, h3) | Playfair Display | 500 (regular), 700 (bold) | Georgia, 'Times New Roman', serif |
| Body text, UI, nav | Inter | 300 (light), 400 (regular), 500 (medium) | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**Type scale:**

| Element | Size | Weight | Line height | Font |
|---------|------|--------|-------------|------|
| h1 (hero) | 36px desktop / 28px mobile | 500 | 1.2 | Playfair Display |
| h2 (section heads) | 28px desktop / 22px mobile | 500 | 1.3 | Playfair Display |
| h3 (card/subsection) | 20px desktop / 18px mobile | 500 | 1.3 | Playfair Display |
| Body | 16px | 400 | 1.7 | Inter |
| Nav links | 14px | 500 | 1 | Inter |
| Captions/meta | 13px | 400 | 1.5 | Inter |
| CTA buttons | 14px | 500 | 1 | Inter, letter-spacing: 0.02em |

### Spacing

- Section padding: 80px vertical desktop, 48px mobile
- Content max-width: 1140px, centered
- Card padding: 24px
- Element gaps: 16px (tight), 24px (standard), 32px (loose)

### Components

**Buttons:**
- Primary: gold background (#c8963e), white text, 6px border-radius, 12px 24px padding
- Secondary: transparent background, 1.5px gold border, gold text
- Hover: darken gold 10% on primary, fill gold on secondary
- Click-to-call: always use `<a href="tel:+19494480961">` with button styling

**Cards:**
- White background, 1px border (#e2e2e0), 8px border-radius
- Hover: subtle lift (translateY -2px) with a soft shadow transition
- No heavy drop shadows

**Section dividers:**
- Alternate white and light-gray backgrounds between sections
- No horizontal rules unless explicitly needed

---

## Site structure and content

### Navigation

**Header (sticky on scroll):**
- Left: "Gregg McElwee | Real Estate & Loans" (text logo, links to homepage)
- Center: Home | About | Specialties | Communities | Blog | Contact
- Right: phone icon + "949.448.0961" (click-to-call)
- Mobile: hamburger menu

**Footer:**
- Three columns: Contact info | Quick links | Social
- Contact: Gregg McElwee | (949) 448-0961 | Gregg@realestateandloans.com
- Quick links: Home, About, Specialties, Communities, Blog, Contact, Privacy
- Social: Facebook (https://www.facebook.com/AmericanHomeReal), LinkedIn (https://www.linkedin.com/in/greggmcelwee/)
- Bottom bar: "© 2026 Gregg McElwee. All rights reserved." and "DRE-licensed real estate professional · San Clemente, California"
- Cross-site link: "Visit greggmcelwee.com for reviews and community guides" or similar natural phrasing

---

### Page 1: Home

**Hero section:**
- Full-width background image (placeholder: San Clemente coastline/pier, swappable later when photographer delivers)
- Dark overlay (navy at ~70% opacity over the image) to ensure text readability
- Headline in gold (#c8963e), Playfair Display 500: **"No one knows the OC better than Gregg McElwee."**
- Subtitle in white, Inter 300, 16px: **"Your home. Your coast. Your agent for nearly 40 years."**
- Two CTAs side by side: "Call 949.448.0961" (primary gold button) and "Get in Touch" (secondary outline button, links to /contact)
- Optional: when Gregg has video footage, replace the static image with a looping background video (muted, autoplay, with the static image as poster/fallback)

**Expertise preview section (light-gray background):**
- Brief 2-3 sentence intro paragraph about Gregg's approach and local knowledge
- Three cards previewing specialties: "Probate & Estate Transitions," "Divorce Real Estate," "Buyers & Sellers." Each with a short description (2 sentences max) and a "Learn more" link to /specialties
- This section differentiates from greggmcelwee.com by leading with expertise categories rather than community geography

**Featured blog posts section (white background):**
- Heading: "Insights from the South OC coast" or similar
- Three most recent blog post cards (image thumbnail, title, date, 1-sentence excerpt, "Read more" link)
- "View all posts" link to /blog

**Communities preview section (light-gray background):**
- Heading: "Communities Gregg serves"
- Six small cards (image thumbnail + community name) linking OUT to greggmcelwee.com community pages: San Clemente, Dana Point, San Juan Capistrano, Mission Viejo, Laguna Hills, Laguna Niguel
- Brief note: "Explore in-depth community guides, market data, and lifestyle info on greggmcelwee.com"

**Contact CTA section (navy background):**
- "Ready to talk?" or "Have a question about South OC real estate?"
- Phone number (click-to-call) and "Send a message" button linking to /contact
- Clean, simple, no form on the homepage itself

---

### Page 2: About

This is NOT a copy of greggmcelwee.com/about. Different angle, different copy.

**greggmcelwee.com/about** tells Gregg's personal story and builds relationship trust.

**realestateandloans.com/about** positions Gregg as a market authority and local expert. Frame around knowledge, insight, and what nearly 40 years of experience means for clients navigating complex real estate situations.

**Content direction (to be written by Simo or AI-assisted from Gregg's input):**
- Opening: the knowledge angle. "Nearly four decades on one stretch of California coast" but focused on what that experience translates to, not biography
- Middle: what makes this practice different. Probate, divorce, estate work alongside traditional buying/selling. The complexity Gregg handles that most agents avoid
- Closing: the personal relationship angle (pulled and enhanced from the existing webcopy). "One thing you will get with me is a personal relationship. In the end, that goes a long way."
- CTA: link to greggmcelwee.com for reviews and the full personal story, plus a contact CTA

**Layout:**
- Gregg's headshot (same portrait from greggmcelwee.com, self-hosted in this repo)
- Text alongside the image on desktop, stacked on mobile
- Pull-quote callout block in gold accent for a standout line

**Existing webcopy to repurpose and enhance** (from the Google Doc):
- "As a current resident in San Clemente I am fully aware of the current market trends and what it takes to get a great deal on a listing or get top dollar for your current home."
- "I have a lot of connections within the San Clemente area."
- "One thing you will get with me is a personal relationship, In the end, that goes a long way."
- "I would love the opportunity to earn your business and partner with you in regards to your Real Estate needs."
- Strip out Agent Elite template language: "wealth of useful Real Estate information," "free, up to date and current Real Estate search," "All the data is fed directly from the MLS"
- Fix "Laguna Nigel" to "Laguna Niguel" (typo in original)

---

### Page 3: Specialties

Dedicated page for Gregg's niche expertise. Strong SEO play targeting long-tail keywords with less competition than generic "real estate agent Orange County."

**Page structure:**
- Hero banner (smaller than homepage, navy background with gold text): "Specialized real estate expertise for life's complex transitions"
- Three main sections, each with its own anchor ID for direct linking:

**Section 3a: Probate & estate transitions** (`/specialties#probate`)
- What probate real estate is, in plain English
- Why it's different from a standard sale
- Why experience matters (court timelines, fiduciary duties, emotional complexity)
- Gregg's specific experience in this area
- SEO targets: "probate real estate Orange County," "probate property sale California," "estate sale real estate agent"

**Section 3b: Divorce real estate** (`/specialties#divorce`)
- How property division works in a divorce sale
- Court-ordered sales, buyouts, timing considerations
- Why a neutral, experienced agent matters
- SEO targets: "divorce real estate agent Orange County," "selling home during divorce California"

**Section 3c: Traditional buying & selling** (`/specialties#buying-selling`)
- Brief section (this is covered more on greggmcelwee.com)
- Focus on what makes Gregg's approach different: local knowledge, personal relationship, no-pressure style
- Link to greggmcelwee.com community pages for area-specific market data
- SEO targets: "real estate agent San Clemente," "South Orange County realtor"

**Each section includes:**
- H2 heading (Playfair Display)
- 3-4 paragraphs of content
- A relevant image or icon
- A CTA ("Talk to Gregg about [specialty]" linking to /contact with a pre-selected dropdown value)

---

### Page 4: Communities

**Lightweight treatment.** This page exists to capture search traffic for "real estate [community name]" queries and funnel visitors to the detailed community guides on greggmcelwee.com.

**Layout:**
- Brief intro: Gregg serves six communities along the South Orange County coast
- Six cards in a 2x3 grid (3x2 on mobile):
  - Community image thumbnail
  - Community name (h3)
  - 2-sentence description
  - "Explore [community name]" link pointing to greggmcelwee.com/[community-slug]
- Communities: San Clemente, Dana Point, San Juan Capistrano, Mission Viejo, Laguna Hills, Laguna Niguel

**Do NOT duplicate the deep content from greggmcelwee.com.** The value of this page is the outbound links (strengthens greggmcelwee.com authority) and the local keyword presence on this domain.

---

### Page 5: Blog

**Blog index page** (`/blog/index.html`):
- Grid of post cards, reverse chronological
- Each card: thumbnail image, post title, date, 1-2 sentence excerpt, "Read more" link
- Pagination or "Load more" as the post count grows (start without it, add when needed)
- Category filter links at the top if/when categories are established

**Individual blog posts** (`/blog/[post-slug].html`):
- Article layout: max-width 720px for readability
- Post title (h1, Playfair Display)
- Date and estimated read time
- Featured image
- Body content with proper heading hierarchy (h2, h3)
- Author line: "By Gregg McElwee"
- Related posts section at the bottom (2-3 other posts)
- CTA at the bottom: "Have questions? Call Gregg at 949.448.0961"
- Article JSON-LD schema (see Technical section)

**Launch state:** Blog structure is ready but launches with zero posts (or 1-2 seed posts if content is available). The automated content pipeline will populate posts over time.

**File structure for posts:**
```
/blog/
  index.html
  selling-home-during-probate-orange-county.html
  san-clemente-real-estate-market-2026.html
  ...
```

Each post is a standalone HTML file. No static site generator needed at launch. If the pipeline grows significantly, Hugo or 11ty can be layered on later without changing the URL structure.

---

### Page 6: Contact

**Contact form that submits to a Google Sheet via Google Apps Script webhook.**

**Form fields:**
- Full name (text, required)
- Email (email, required)
- Phone (tel, optional)
- What can I help with? (dropdown: Buying, Selling, Probate / Estate, Divorce Real Estate, Refinance, General Question)
- Message (textarea, required)
- Submit button: "Send Message" (gold primary button)

**Google Apps Script integration:**
- Deploy a Google Apps Script as a web app that receives POST requests
- Script writes form data to a Google Sheet (one row per submission) with columns: Timestamp, Name, Email, Phone, Category, Message
- The sheet lives under Gregg's Google account
- Form submits via `fetch()` to the Apps Script URL
- On success: show a confirmation message ("Thanks, Gregg will be in touch shortly.")
- On error: show a fallback message ("Something went wrong. Please call 949.448.0961 directly.")
- No third-party form service (Formspree, Netlify Forms, etc.)

**Contact info displayed alongside the form:**
- Gregg McElwee
- (949) 448-0961 (click-to-call)
- Gregg@realestateandloans.com (mailto link)
- San Clemente, California
- Facebook and LinkedIn icons with links

**Security:**
- Honeypot field (hidden, if filled = bot, reject submission)
- Basic client-side validation
- Rate limiting on the Apps Script side (reject if same IP/email submits more than 3x in 10 minutes)
- No sensitive data stored, standard contact form fields only
- HTTPS enforced by GitHub Pages

---

### Page 7: Privacy Policy

**Boilerplate privacy policy page.** Required for credibility and compliance.

**Content covers:**
- What data is collected (contact form submissions: name, email, phone, message)
- How data is used (to respond to inquiries, no marketing without consent)
- No data sold to third parties
- Cookies: minimal (no tracking cookies, no analytics cookies at launch; add a note about Google Analytics if added later)
- Contact for privacy questions: Gregg@realestateandloans.com
- Last updated date

**Layout:** Simple text page, same max-width as blog posts (720px). No special design treatment needed.

---

### Hidden but indexable pages

These pages are NOT in the main navigation but ARE in the sitemap, internally linked from blog posts and specialty pages, and crawlable by search engines. They target specific long-tail search queries.

**Launch set (3-5 seed pages):**
1. "What Happens to Real Estate in a California Probate" (`/guides/probate-real-estate-california.html`)
2. "Selling a Home During Divorce in Orange County" (`/guides/divorce-home-sale-orange-county.html`)
3. "First-Time Homebuyer Guide: San Clemente" (`/guides/first-time-buyer-san-clemente.html`)
4. "How to Choose a Real Estate Agent in South OC" (`/guides/choosing-agent-south-orange-county.html`)
5. "Orange County Real Estate Market Overview" (`/guides/orange-county-market-overview.html`)

**Template:** Same layout as blog posts (article format, 720px max-width, heading hierarchy, CTA at bottom). The difference is these live in `/guides/` not `/blog/` and are evergreen reference content rather than dated posts.

**Internal linking strategy:**
- Blog posts link to relevant guides ("For a deeper look at how probate works in California, see our guide")
- Specialty page sections link to their corresponding guides
- Guides link to the contact page and to relevant greggmcelwee.com community pages
- All guides appear in sitemap.xml

**Future pipeline:** Additional guides and resource pages get added over time following the same template. Target: 50+ total indexable content pages across blog posts and guides combined.

---

## Technical requirements

### File structure

```
realestateandloans-site/
├── index.html                          # Home
├── about.html                          # About
├── specialties.html                    # Specialties
├── communities.html                    # Communities
├── contact.html                        # Contact
├── privacy.html                        # Privacy Policy
├── 404.html                            # Custom 404 with redirect logic
├── sitemap.xml
├── robots.txt
├── CNAME                               # realestateandloans.com
├── blog/
│   ├── index.html                      # Blog listing page
│   └── [post-slug].html               # Individual posts
├── guides/
│   └── [guide-slug].html              # Evergreen resource pages
├── assets/
│   ├── css/
│   │   └── style.css                  # Single stylesheet
│   ├── js/
│   │   ├── main.js                    # Nav, scroll behavior, form handling
│   │   └── redirects.js               # Old URL redirect mapping
│   ├── fonts/
│   │   ├── PlayfairDisplay-Medium.woff2
│   │   ├── PlayfairDisplay-Bold.woff2
│   │   ├── Inter-Light.woff2
│   │   ├── Inter-Regular.woff2
│   │   └── Inter-Medium.woff2
│   └── images/
│       ├── hero-placeholder.webp       # Hero background (swappable)
│       ├── gregg-portrait.webp         # Headshot
│       ├── og-image.png                # Open Graph fallback
│       └── communities/               # Community card thumbnails
│           ├── san-clemente.webp
│           ├── dana-point.webp
│           ├── san-juan-capistrano.webp
│           ├── mission-viejo.webp
│           ├── laguna-hills.webp
│           └── laguna-niguel.webp
└── apps-script/
    └── contact-form-handler.gs         # Google Apps Script source (for reference, deployed separately)
```

### SEO

**Every page must include:**
- Unique `<title>` tag (format: "Page Title | Gregg McElwee, Real Estate & Loans")
- Unique `<meta name="description">` (150-160 chars, includes primary keyword)
- Canonical URL: `<link rel="canonical" href="https://realestateandloans.com/[path]">`
- Open Graph tags: og:title, og:description, og:image, og:url, og:type, og:site_name
- Twitter Card tags: twitter:card (summary_large_image), twitter:title, twitter:description, twitter:image
- Mobile viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`

**sitemap.xml:** List all pages including blog posts, guides, and hidden content pages. Exclude 404.html.

**robots.txt:**
```
User-agent: *
Allow: /
Sitemap: https://realestateandloans.com/sitemap.xml
```

### JSON-LD structured data

**Every page gets a base LocalBusiness + RealEstateAgent schema in the `<head>`:**

```json
{
  "@context": "https://schema.org",
  "@type": ["RealEstateAgent", "LocalBusiness"],
  "name": "Gregg McElwee, Real Estate and Loans",
  "url": "https://realestateandloans.com",
  "telephone": "+1-949-448-0961",
  "email": "Gregg@realestateandloans.com",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "San Clemente",
    "addressRegion": "CA",
    "addressCountry": "US"
  },
  "areaServed": [
    {"@type": "City", "name": "San Clemente"},
    {"@type": "City", "name": "Dana Point"},
    {"@type": "City", "name": "San Juan Capistrano"},
    {"@type": "City", "name": "Mission Viejo"},
    {"@type": "City", "name": "Laguna Hills"},
    {"@type": "City", "name": "Laguna Niguel"}
  ],
  "sameAs": [
    "https://www.facebook.com/AmericanHomeReal",
    "https://www.linkedin.com/in/greggmcelwee/",
    "https://greggmcelwee.com"
  ],
  "knowsAbout": ["Probate Real Estate", "Divorce Real Estate", "Residential Real Estate", "Home Loans"],
  "description": "Nearly 40 years of residential real estate expertise across South Orange County. Specializing in probate, divorce, and estate transitions."
}
```

**Blog posts additionally get Article schema:**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[Post Title]",
  "author": {
    "@type": "Person",
    "name": "Gregg McElwee"
  },
  "datePublished": "[ISO date]",
  "dateModified": "[ISO date]",
  "publisher": {
    "@type": "Organization",
    "name": "Gregg McElwee, Real Estate and Loans"
  },
  "mainEntityOfPage": "[canonical URL]"
}
```

**Specialties page gets Service schema** for each specialty section (probate, divorce, buying/selling).

### Redirect handling (404.html)

Old Agent Elite URLs that may still be indexed need to redirect:

```javascript
const redirects = {
  '/contact-form/': '/contact',
  '/category/blog/': '/blog/',
  '/real-estate-news/': '/blog/',
  '/communities/': '/communities'
};
```

The custom 404.html checks `window.location.pathname` against this map and redirects if matched. Otherwise displays a clean "Page not found" message with links to Home and Contact.

### Responsive breakpoints

- Desktop: 1024px+
- Tablet: 768px - 1023px
- Mobile: < 768px

Use CSS Grid and Flexbox. No framework. Test hero text sizing carefully at mobile widths to ensure the headline doesn't break awkwardly.

### Performance targets

- No external CDN calls (fonts self-hosted, no analytics at launch, no third-party scripts)
- Images in WebP format with appropriate dimensions (hero: 1920px wide, cards: 600px wide, thumbnails: 400px wide)
- Single CSS file, single JS file (or split into main.js + redirects.js)
- Target: < 1 second first contentful paint on 4G

### Accessibility

- All images have descriptive alt text
- Color contrast meets WCAG AA (the navy/white and gold/navy combinations pass)
- Form fields have associated labels
- Keyboard navigable (focus states on all interactive elements)
- Semantic HTML (header, nav, main, article, section, footer)
- Skip-to-content link

---

## Cross-site linking strategy

| From | To | Context |
|------|----|---------|
| realestateandloans.com/communities | greggmcelwee.com/[community] | Each community card links to the full guide |
| realestateandloans.com/about | greggmcelwee.com/reviews | "See what clients say" or similar |
| realestateandloans.com footer | greggmcelwee.com | "Visit greggmcelwee.com" natural link |
| realestateandloans.com blog posts | greggmcelwee.com/[community] | Contextual links in posts about specific areas |
| greggmcelwee.com (future update) | realestateandloans.com/blog | "Market insights and resources" link in footer or about page |

Both sites share the same contact info: Gregg McElwee | (949) 448-0961 | Gregg@realestateandloans.com

Both sites link to the same social profiles (Facebook, LinkedIn).

---

## What is NOT on this site

- No mortgage calculator (greggmcelwee.com has one)
- No reviews or testimonials section (greggmcelwee.com owns that)
- No deep community content (link to greggmcelwee.com for that)
- No IDX or property search
- No Google Analytics at launch (can be added later)
- No chat widget or chatbot
- No pop-ups or modals

---

## Content pipeline (post-launch)

Blog posts and guide pages will be created through an automated pipeline (separate system, not part of this build). The site just needs to support adding new HTML files to `/blog/` and `/guides/` and updating the blog index and sitemap.

A topic list for Gregg to review and approve will be provided separately. The workflow: Gregg records voice memos on each topic, AI generates draft content from the recordings, Simo reviews and publishes.

---

## Placeholder images needed at build time

| Image | Dimensions | Purpose | Source |
|-------|-----------|---------|--------|
| Hero background | 1920x1080px | Homepage hero | Free stock (San Clemente coastline) |
| Gregg portrait | 600x800px | About page, small usage on home | Download from Agent Elite CDN before cutover |
| Community thumbnails (x6) | 400x300px | Community cards | Free stock (South OC coastal/neighborhood) |
| Blog post placeholder | 800x450px | Featured posts on home (if seed posts exist) | Free stock or skip until real posts exist |
| OG image | 1200x630px | Social sharing fallback | Can be generated (navy bg + gold text + site name) |

All images should be provided as WebP. Include PNG/JPG originals as fallbacks if needed.
