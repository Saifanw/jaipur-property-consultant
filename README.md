# jaipur-property-consultant
Jaipur Property Consultant – Buy, Sell &amp; Invest in Jaipur Properties. Residential Plots, Property Consultation, Land, Commercial Property and Real Estate Assistance in Jaipur.


## CRM V1.1 update
- Advanced CRM filters for large record sets
- Admin Login link on the public website
- Optional, admin-approved public requirement cards
- Public requirement data is separated from private CRM data via `publicRequirements`


### Public submissions
The homepage now accepts buyer/seller submissions into the private `publicSubmissions` collection. Admin reviews them under **Public Submissions** and can approve/reject. Approved entries create a private CRM record plus a sanitized `publicRequirements` record.


### V3
Added approved Properties page, property detail pages, review approval, customer-property matching, follow-up reminders, and CRM analytics.


### Website Analytics
Google Analytics 4 is included on the public pages using measurement ID `G-0DW0NBETML`. Use the Admin dashboard **Website Analytics** button to open Google Analytics.

## v3 changes
- Public site shares `assets/site.css`, `assets/config.js`, `assets/sprite.js`, `assets/app.js` (config, helpers, slider, lightbox, save, share). Edit `assets/config.js` for phone, RERA, years, office hours, areas and commission rates.
- New pages: `partner.html` (sell & earn, calculator, FAQ, lead form), rebuilt `properties.html` and `reviews.html`.
- PWA basics: `manifest.json`, `sw.js`, `assets/icons/` (base for the future "Apna Ghar" app).
- Admin: every property (seller) gets a code like JPC-001 (auto-assigned); customers link to the property they want; table shows date, highlighted mobile, interested property, location, budget, follow-up; "interested customers" list inside each property; multi-photo manager.
- Website enquiries / partner form arrive in Public Submissions as "Add to CRM" (private, never published).
- Rules unchanged: deploy `firestore.rules` and `storage.rules` as before.


## v4 — Property page & Q&A
- New optional property fields (admin form): facing, road width, area in Gaj, corner, patta, registry, home loan, society, landmark, map link, highlights, nearby. All appear on the public property page in clean cards; a listing-quality score helps you fill them.
- Property page: size auto-converts (feet x feet -> Gaj / sq ft), rate per Gaj, legal badges, map, FAQs, EMI estimate, site-visit button, print/PDF, schema.org data. Similar properties now show only the same type.
- Public Q&A: visitors ask on the property page -> Admin > Inbox > Questions -> you answer -> it is shown publicly. If they leave a mobile it also arrives as a private enquiry.
- **Deploy `firestore.rules` again** (new `publicQuestions` collection) or questions will not save.

- **Ad post** (Admin > property form): auto-generates a ready post (WhatsApp short or OLX/99acres full, Hindi/English) from the property details + public link + your phone. Edit, Copy, send on WhatsApp; the text is saved privately with the property (`adPost`).

- **Comments & questions are Facebook-style threads**: visitor comment/question -> Admin > Inbox -> Publish (optionally with your reply) -> shown on the property page with your replies under it (gold "Owner" badge). You can add more replies later, delete a reply, or unpublish. Re-deploy `firestore.rules`.


## v5 — smart search, smarter matching, SEO and safety
- `assets/match.js` is the one engine for search and matching (tests: `node tests/match.test.js`).
- Website search understands sentences: `50 gaj plot jhotwara under 40 lakh`, `2 bhk flat vaishali`, `JPC-005`, Hindi/Hinglish words (zameen, makaan, dukan) and spelling mistakes. All filters now stay in the page link, so a shared search link opens the same results. When nothing matches, the closest properties are shown.
- CRM matching now scores area (same / nearby), type family, budget (graded), and size (gaj / BHK). Contacts have a new **Size / BHK** field. Edit `NEARBY` in `assets/match.js` to change which areas count as close.
- Set `siteUrl` in `assets/config.js` so links sent from Admin on WhatsApp always use your public domain.
- Worker now serves `/robots.txt`, `/sitemap.xml` (includes live properties), `/geo`, canonical links, favicon and security headers; admin/CRM pages send `noindex`.
- `.assetsignore` is now correctly named (it was `assetsignore`), `crm-demo.html` and the 2.5 MB `storefront.png` were removed.
- Firestore rules: public forms have size limits; admin also needs a verified email. **Re-deploy `firestore.rules` and `storage.rules`.**
- New `privacy.html` (draft - have it reviewed) linked from the footer.
