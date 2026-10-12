# Jaipur Property Consultant — Website Analytics

## Included
- `assets/jpc-analytics-tracker.js`: page-view tracking on public pages.
- `visitor-analytics.html`: private dashboard with page views, unique browser visitor IDs, active visitors (last 5 minutes), top pages, sources, referring domains, device breakdown and CSV export.
- `firestore.rules`: rules updated to allow anonymous visitor event creation and admin-only analytics reads.
- `admin.html`: adds a link to the private analytics dashboard.
- Public tracker added to `index.html`, `properties.html`, `property.html`, `partner.html`, and `reviews.html`.

## Required Firebase setup before data collection
1. Open Firebase Console for project `jaipur-property-consultant`.
2. Authentication → Sign-in method → enable **Anonymous**.
3. Publish the included `firestore.rules` in Firestore Rules. Review/merge if you have newer live rules; do not blindly overwrite rules changed outside this ZIP.
4. Deploy the updated website files.
5. Visit the public website, then open `visitor-analytics.html` and sign in using the configured admin Google account (`saif.anwar1618@gmail.com`).

## Important
- The dashboard starts empty until the tracker is deployed and Firebase setup is completed.
- No exact GPS location or IP address is collected. City/country estimates are not included because a browser-only tracker cannot reliably infer them without an external geolocation/analytics provider.
- The tracker counts page loads. A returning visitor is approximated by a browser-local random ID; clearing browser storage or switching browsers/devices creates a new visitor ID.
- This does not automatically integrate Google Analytics/GA4; it is a separate, lightweight Firebase-based dashboard.
