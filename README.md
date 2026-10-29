# StayBook — Online Booking

This project contains only the Online Booking module, built with XianFire `.xian` templates and compiled Tailwind CSS. PMS, housekeeping, POS and HR belong to other team members and are not implemented here.

Current workflow: search the sample room catalog, select dates and occupancy, enter guest details, review the server-calculated total and save a booking with a simulated payment. Guests can print the booking, find it again using a booking reference and email, or cancel it with a simulated refund. Booking records and sessions use this module's own `online_booking` MySQL database.

```powershell
cd 'C:\Users\kenji\OneDrive\Desktop\Event Driven System\online-booking'
npm install
npm run setup
npm run build
npm start
```

Open [StayBook](http://127.0.0.1:3000). `npm test` checks the guest booking flow and input validation.

Start MySQL in Laragon before setup. Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` in `.env` if needed. Migration creates only this module's tables without dropping existing data. Six sample rooms are seeded; no guest bookings are seeded. Payments are simulated and do not charge real money.

Future integration is deferred: `services/pmsApi.js` contains the local sample catalog and a TODO where the agreed PMS API adapter can be added. Other systems' databases are not accessed. Local bookings use `LOCAL_CONFIRMED`, which does not mean the PMS has acknowledged a hotel reservation.
