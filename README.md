# StayBook — Online Booking

This project contains only the Online Booking module, built with XianFire `.xian` templates and compiled Tailwind CSS. PMS, housekeeping, POS and HR belong to other team members and are not implemented here.

Current workflow: search the sample room catalog, select dates and occupancy, enter guest details and review the server-calculated reservation estimate.

```powershell
cd 'C:\Users\kenji\OneDrive\Desktop\Event Driven System\online-booking'
npm install
npm run build
npm start
```

Open [StayBook](http://127.0.0.1:3000). `npm test` checks the guest booking flow and input validation.

Future integration is deferred: `services/pmsApi.js` contains the sample catalog and a TODO where the agreed PMS API adapter can be added. Other systems' databases are not accessed. A preview is not a confirmed hotel reservation.
