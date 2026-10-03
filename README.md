# jaipur-property-consultant
Jaipur Property Consultant – Buy, Sell &amp; Invest in Jaipur Properties. Residential Plots, Property Consultation, Land, Commercial Property and Real Estate Assistance in Jaipur.


## CRM V1.1 update
- Advanced CRM filters for large record sets
- Admin Login link on the public website
- Optional, admin-approved public requirement cards
- Public requirement data is separated from private CRM data via `publicRequirements`


### Public submissions
The homepage now accepts buyer/seller submissions into the private `publicSubmissions` collection. Admin reviews them under **Public Submissions** and can approve/reject. Approved entries create a private CRM record plus a sanitized `publicRequirements` record.
