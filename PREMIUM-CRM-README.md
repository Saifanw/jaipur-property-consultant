# Premium Property Business OS — CRM Update

This version redesigns the existing private CRM into a more product-like property business workspace.

## Main changes
- Premium, clean dashboard UI
- Clear owner-first value proposition
- Quick actions: Add Customer, Add Property, Find Match, Follow-ups
- Hot Leads / Needs Attention panel
- Today's Follow-ups panel
- Visual sales pipeline
- Cleaner CRM table and responsive layout
- Existing Firebase CRM, matching, follow-up, reviews, analytics, import/export functionality retained
- `crm-demo.html` is a static sales/demo page using fictional sample data; it can be used for screenshots/posts without exposing private CRM data.

## Important
The redesigned `admin.html` keeps the existing Firebase configuration, authentication, Firestore collections, Storage flow and CRM logic from the supplied project. Review and test it in your own Firebase/GitHub Pages environment before publishing.

## Sales positioning
The product should not be marketed as “just a CRM”. The core promise is:

**Capture every enquiry → never miss follow-ups → find matching properties → move leads toward a deal.**

Use the demo page and screenshots to explain the business problem before discussing price.

## WhatsApp Lead Follow-up
- Select one or multiple CRM records from the All Records table.
- Use the green WhatsApp toolbar to open a personalised WhatsApp queue.
- Message template supports `{name}`, `{area}`, `{propertyType}`, and `{budget}` placeholders.
- Each selected contact can be opened one-by-one with a pre-filled WhatsApp Web message.
- Direct automatic sending is intentionally not enabled; WhatsApp Web requires the user to press Send. A true automated bulk sender would require the official WhatsApp Business/Cloud API and its credentials/approved templates.
