# Jaipur Property Consultant — CRM V1

This package adds a private CRM admin page to the existing GitHub Pages website.

## V1 features

- Google sign-in for the private admin page
- Customer / Buyer records
- Seller / Owner records
- Broker / Agent records
- Search and filter
- Customer / seller / broker counts
- Excel/CSV import
- Excel export
- Optional private image uploads to Firebase Storage
- Private Firestore collection: `crmContacts`
- Private notes and exact address fields
- Edit/delete records

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
