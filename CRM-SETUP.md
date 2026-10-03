# Jaipur Property Consultant — CRM V1.1

This package adds a private CRM admin page to the existing GitHub Pages website.

## V1 features

- Google sign-in for the private admin page
- Customer / Buyer records
- Seller / Owner records
- Broker / Agent records
- Search and advanced filters (area, property type, status, budget)
- Public website requirement cards with admin approval
- Customer / seller / broker counts
- Excel/CSV import
- Excel export
- Optional private image uploads to Firebase Storage
- Private Firestore collection: `crmContacts` (private)
- Sanitized public requirement collection: `publicRequirements`
- Private notes and exact address fields
- Edit/delete records
- Discreet Admin Login link from the public homepage

## 1. Add your admin Gmail

Open `admin.html` and replace:

`saif.anwar1618@gmail.com`

inside `ADMIN_EMAILS` with the Google account you will use.

Do NOT put a password or Firebase service-account JSON in this file.

## 2. Firestore Rules

In Firebase Console → Firestore Database → Rules, paste the contents of:

`firestore.rules`

Replace the placeholder Gmail first.

## 3. Storage Rules

In Firebase Console → Storage → Rules, paste the contents of:

`storage.rules`

Replace the placeholder Gmail first.

## 4. Publish

Upload `admin.html` to the same GitHub Pages repository as `index.html`.

The private admin page will be:

`https://YOUR-USERNAME.github.io/jaipur-property-consultant/admin.html`

## Excel import columns

Recommended headers:

Type, Name, Mobile, WhatsApp, Email, Area, City, Property Type, Size,
Budget Min, Budget Max, Status, Source, Company, Areas Served,
Property Location, Details, Notes

Type must be:
- customer
- seller
- broker

Rows without Name or Mobile are skipped.

## Important privacy rule

Customer/owner phone numbers, exact addresses and private notes must never be put in the public property JSON or GitHub public files. They stay in Firebase behind admin authentication.


## Public requirement cards

When editing/creating a CRM record, use **Show this requirement on the public website** only for records you are authorized to publish.

The public website reads only `publicRequirements`, not the private `crmContacts` collection. The public copy contains only:
- Display name
- Area / city
- Property type
- Size
- Budget
- Requirement/property details
- Status

It does **not** publish mobile number, WhatsApp number, email, exact address, private notes, or private images.

After publishing the updated `firestore.rules`, approved cards appear automatically on the homepage under **Active Requirements**. The homepage also includes a small **Admin Login** link for the private CRM.


## V3 modules
- `properties.html` — approved seller/property listings with location, type and budget filters.
- `property.html?id=DOCUMENT_ID` — public property detail page.
- `reviews.html` — public reviews submission and approved reviews.
- Admin tabs: Public Submissions, Matching, Follow-ups, Reviews, Analytics.
- New Firestore collections: `publicReviews`, `crmMatches`.
- CRM fields `followUpDate` and `followUpNote` power the follow-up dashboard.
- Public seller listings remain sanitized; owner contact and exact private address are not published.
