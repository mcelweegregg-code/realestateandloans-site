# FAQ Section — specialties.html
## Draft copy for Gregg's review before Claude Code implementation

This block goes at the bottom of the Specialties page, below the three specialty sections and above the page CTA. It targets keywords 3, 4, 9, and 14 from the SEO list, and is written to match entries that appear in Google's People Also Ask boxes for those queries.

Voice notes: short answers, plain language, first person where it fits, no buzzwords, no em dashes.

---

## Suggested HTML section heading

**"Common questions about probate, divorce, and estate sales"**

(Or just: "Questions people ask me a lot." — more Gregg, less formal. Your call.)

---

## FAQ ITEMS

---

### Q: What is probate real estate and how does it work in California?

When a property owner in California passes away, that property usually has to go through probate before it can be sold. Probate is a court-supervised process that settles the estate, pays any debts, and distributes what is left to the heirs. The court appoints an executor or administrator to manage the sale, and there are specific legal steps involved that most standard real estate transactions never touch.

It is not complicated once you know the process, but it does take time. The court sets the timeline, not the agent, not the family. In my experience, most probate sales in Orange County take somewhere between nine months and a year and a half from start to close, depending on the complexity of the estate and how busy the courts are.

The short version: if you are an executor or a family member dealing with a property that has to go through probate, you need an agent who has done this before. The paperwork is different, the court requirements are different, and the emotional weight on the family is real. That is what I do.

---

### Q: How long does probate take in California?

The honest answer is nine to eighteen months, on average. Small estates with few creditors and straightforward family situations can move faster. Large estates, contested wills, or missing heirs can drag things out well past that.

California law says the personal representative has one year from the date of appointment to complete probate, with an extension available if a federal estate tax is involved. That is the legal target. Reality often runs longer, especially with court backlog.

What I tell people: plan for a year, hope for less, and do not let anyone pressure you into rushing decisions during the process. The property will sell when the process is complete. In the meantime, the estate is still paying property taxes, insurance, and any maintenance costs, so staying organized and moving things forward steadily matters.

---

### Q: Can I sell a house while going through a divorce in California?

Yes, and in many cases it makes more financial sense than trying to hold onto it. California is a [community property state](https://selfhelp.courts.ca.gov/divorce/property-debts), which means if the home was bought during the marriage, both spouses generally own an equal share. The house either gets sold and the proceeds split, or one spouse buys the other out by refinancing.

If both parties agree, the sale can move forward like a normal transaction. If one party is refusing to cooperate, the other can petition the court for an order authorizing the sale. Either way, the agent needs to be neutral and professional with both sides. That is not always easy, but it is the job.

I have handled a number of these. The key is keeping the transaction separate from the personal situation. Two parties who are not getting along can still get a property sold at a fair price. It just takes patience and someone who knows how to keep things on track.

---

### Q: What is a court-ordered home sale?

A court-ordered sale happens when a judge issues an order requiring that a property be sold, usually because the parties involved cannot reach an agreement on their own. This comes up most often in two situations: contested divorces where one spouse will not agree to sell, and probate cases where the heirs cannot agree on what to do with the property.

Once a court order is in place, the sale proceeds under the court's supervision. Both parties are bound by the order, and the agent's job is to execute the sale cleanly within whatever terms the court has set. It is more structured than a standard sale, but it is workable.

If you are facing a court-ordered sale in Orange County, the main thing to know is that you need an agent who is familiar with the process and can work professionally with both parties and their attorneys. The legal side is handled by the lawyers. The real estate side is handled by me.

---

### Q: Do I need a specialist to sell a probate property, or can any agent do it?

Any licensed agent can technically list a probate property. Whether they know what they are doing is a different question.

Probate sales involve court confirmation requirements, specific documentation, fiduciary duties on the part of the executor, and in some cases a mandatory overbidding process at the courthouse. An agent who has not handled these before can make mistakes that delay the sale or create problems for the estate.

I am not going to tell you I am the only person who can do this. But I will say that nearly 40 years in this business, with a focus on probate and estate work in Orange County, means I have seen most of what can go wrong. That experience has value, especially in a process where delays cost the estate money every month the property sits.

---

## Implementation note for Claude Code

Add this as a new `<section>` block in `specialties.html`, after the `#buying-selling` section and before the page-level contact CTA.

The section should follow the existing page design patterns:
- Section heading in Playfair Display H2
- Each Q in a styled H3 (not an accordion — keep it simple and crawlable)
- Answer paragraphs in standard body copy
- Light gray background (`--light-gray`) to visually separate from the specialty sections above
- Add `id="faq"` to the section for direct linking
- Add FAQ schema (JSON-LD `FAQPage` type) to the page `<head>` using the Q&A pairs above

The JSON-LD schema block should follow the existing structured data pattern already in the page head.
