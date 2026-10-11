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
