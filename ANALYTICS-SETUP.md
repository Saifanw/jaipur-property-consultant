# Jaipur Property Consultant — Website Analytics v2

## What you get
- `assets/jpc-analytics-tracker.js` (v2): sessions, new/returning visitors, source/channel/UTM campaign, device/OS/browser, screen, language,
  approximate city/state/country, time on page, scroll depth, and actions (call, WhatsApp, email, map, property opens, outbound links, form start/submit).
- `visitor-analytics.html`: private dashboard — date presets + compare with previous period, 12 filters + search (click any bar to filter),
  KPI cards with trends, traffic chart, visitor funnel, live visitors + activity feed, sources/channels/campaigns, countries/states/cities,
  devices/OS/browsers, top pages & properties, time/scroll distributions, weekday×hour heatmap, session journeys, visitor list, action log,
  Leads received (from `publicSubmissions`), CSV export (sessions / visitors / page views / actions).
- `firestore.rules`: adds `websiteEvents` and lets a visitor update only their own page-view counters.

## Setup (once)
1. Firebase Console → Authentication → Sign-in method → keep **Anonymous** enabled.
2. Firestore → Rules → merge/publish the included `firestore.rules` (the analytics section at the bottom is new). **Without this, the new data is rejected.**
3. Deploy the website files.
4. Open any public page once with `?notrack=1` on your own phone/laptop to exclude your own visits (signed-in admin visits are skipped automatically).

## Notes
- Old records (before v2) still show, but have no session/time/scroll/location data.
- Location uses a free no-key lookup (ipwho.is) from the visitor's browser; the IP is not stored. Disable with `analytics: { geo: false }` in `assets/config.js`.
- Form "submitted" counts attempts; real enquiries are the **Leads received** KPI.
- Firestore free quota: each page view costs ~3–6 writes. The dashboard reads every record in the selected range (cap 20,000 per collection) — use shorter ranges when traffic grows.
- Visitor IDs are per browser; clearing data or switching device creates a new visitor.
