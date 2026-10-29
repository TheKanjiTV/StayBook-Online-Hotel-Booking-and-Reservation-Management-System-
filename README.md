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

## Project scope

Set `EXCHANGERATE_API_KEY` in the local ignored `.env` to use the authenticated ExchangeRate-API Standard endpoint. The key is read only by the server; `.env.example` contains an empty placeholder. Standard responses use `conversion_rates`; the no-key open endpoint remains available for a fresh checkout. Daily cached data is separated by provider/key fingerprint, and provider URLs/keys are never returned in browser responses or logged on errors.

| System | Responsibility in this repository |
| --- | --- |
| Online Booking | Implemented here: room search, guest information, local reservations, simulated payments, booking review/printing, lookup and cancellation |
| Front Desk / PMS | Owned by another member; future API integration only |
| Housekeeping / Maintenance | Owned by another member; not implemented here |
| Hotel POS | Owned by another member; not implemented here |
| HR / Payroll | Owned by another member; not implemented here |

There is no staff operations dashboard, PMS inventory management, check-in/out, cleaning task management, POS or payroll in this project.

Guest accounts are optional. `/sign-in` and `/join` provide sign-in and account creation; `/account` lists bookings made while signed in. Passwords use salted scrypt hashes, sign-in rotates the session, and account APIs enforce ownership. Existing guest reservations are never claimed just because an account uses the same email. Guests can continue using reference/email lookup. This local account flow does not send verification or password-reset emails.

The header supports English, Filipino, Simplified Chinese, Japanese, Korean, Spanish, French, German and Arabic (including right-to-left layout). Changing language also selects its default display currency; Filipino selects PHP. Currency can then be changed independently to any of the 36 codes in the supplied reference. Preferences persist in the session. Conversion is indicative; booking/payment amounts remain in PHP. ExchangeRate-API supplies daily rates, cached locally in ignored `.test-data/`; a last available rate retains its date, and PHP remains usable when rates are unavailable. Language changes preserve non-password form fields in session storage for the immediate reload. JavaScript is required for translated interface copy and booking interactions.

## Future API and database integration — not implemented yet

The following are **proposed contracts to discuss with the PMS member**, not working endpoints in this repository:

| Booking action | Proposed PMS endpoint | Purpose |
| --- | --- | --- |
| Search rooms | `GET /api/rooms/available?checkIn=...&checkOut=...&guests=...` | Read authoritative room IDs, date-range availability and rates |
| Save reservation | `POST /api/reservations` | Send validated guest details, room ID, dates, payment reference and a unique request key; receive the PMS reservation ID and status |
| Read booking status | `GET /api/reservations/:id` | Check the PMS acknowledgement and current reservation status |
| Cancel reservation | `POST /api/reservations/:id/cancel` | Receive cancellation acknowledgement and agree on the refund result |

Integration steps for the next phase:

1. Agree on endpoint paths, JSON field names, authentication, error responses and ownership of `room_id`, `guest_id` and `reservation_id`.
2. Replace the local sample-room access in `services/pmsApi.js` with server-to-server HTTP requests. Keep service credentials on the backend.
3. Add PMS ID/status fields to this module's booking records through a non-destructive migration. Keep the local request key for safe retries.
4. Recheck PMS availability and the authoritative total before confirming. Show a pending state until the PMS acknowledges the reservation; an HTTP failure must not become a success message.
5. Agree on the `RoomBooked` event and cancellation/refund acknowledgement. The PMS member handles downstream room status and communication with housekeeping/POS/HR.
6. Test timeouts, failed payments, retry duplication, conflicting reservations and cancellations with the actual team API.

**Database boundary:** this repository connects only to its own `DB_NAME` (`online_booking` by default). The other members own their databases. Integration should exchange agreed IDs and payloads through APIs rather than reading or writing their tables directly. The sample catalog and local conflict checks cannot guarantee real hotel availability until PMS integration is completed.

## Current local endpoints

`/hotels` browses two explicitly illustrative properties, with name/collection search and hotel/resort filters. The original six sample rooms are divided between them; `/rooms?hotelId=1` or `2` searches that property's rooms. This is a local catalog, not a live PMS hotel directory. Restaurants & Bars stays disabled until Denver supplies the HotelPOS URL. My StayBook provides the optional account area; there are no invented loyalty rewards or discounts.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/`, `/rooms`, `/guest-details` | Guest booking pages |
| GET | `/hotels` | Search/filter the sample property directory |
| GET | `/sign-in`, `/join`, `/account` | Optional guest account pages |
| POST | `/api/auth/register`, `/api/auth/sign-in`, `/api/auth/sign-out` | Account session actions |
| GET | `/api/account/bookings` | Signed-in account's booking history |
| POST | `/api/account/bookings/open` | Open an account-owned booking |
| GET | `/api/account/notifications` | Account-only booking notifications |
| POST | `/api/account/notifications/read` | Mark the account's notifications read |
| POST | `/api/preferences` | Persist language and display currency |
| GET | `/rooms/search` | Search local sample rooms by dates and guest count |
| POST | `/booking/preview` | Validate guest details and calculate the total server-side |
| GET | `/confirmation` | Review or display the current local booking |
| GET | `/receipt` | Compact printable receipt for the session-owned booking |
| GET | `/api/booking-preview` | Current session's review data |
| POST | `/api/bookings/confirm` | Save the local booking and simulated payment atomically |
| GET | `/api/bookings/current` | Current session's saved booking |
| GET | `/manage-booking` | Booking-reference lookup page |
| POST | `/api/bookings/lookup` | Find a booking using its reference and matching email |
| POST | `/api/bookings/cancel` | Cancel the session-owned local booking and record a simulated refund |

Mutation requests use the session cookie and CSRF token from the page. Prices are read from the local catalog, not trusted from browser input. Confirmation retries reuse the server-generated request key. Room rows are locked while checking for overlapping local reservations.

## Development and commits

### Booking administration

Accounts default to `GUEST`. Registration cannot assign admin roles. To grant admin access to an existing local account, run `npm run migrate`, then `node scripts/promote-admin.js <username-or-email>` with access to this module's database. The command grants a role only; it does not create credentials or reset passwords.

Admin sign-in opens a separate sidebar workspace. `/admin` is the dashboard, `/admin/bookings` lists reservations, `/admin/users` manages accounts, and `/admin/audit-logs` shows the immutable activity history. All admin pages and mutations check the current database role; writes require CSRF protection. The guest navigation/footer are not used in this workspace.

Bookings can be approved, edited, cancelled or deleted. Approval sets `ADMIN_CONFIRMED` (Confirmed in StayBook), which still blocks overlapping reservations and does not imply PMS acknowledgement. Room/date changes check availability, recalculate prices on the server and return the reservation to `LOCAL_CONFIRMED` (awaiting admin confirmation). Edits use integer revisions to reject stale forms. Deleting an active booking cancels it transactionally, records the local refund and removes it from ordinary queries while keeping its payment and audit records. Totals remain in PHP; no real payment/refund or hotel/PMS status is performed.

Users supports creating accounts, editing profiles/usernames/roles, resetting passwords and deleting account access. Public registration always creates a guest. Role changes are serialized so the last administrator cannot be removed; self-deletion is rejected. Password resets increment a session version, invalidating old sessions, including the current session when resetting one's own password. Account deletion also revokes access and preserves reservation ownership/history. Password hashes and plaintext passwords never appear in forms, API responses or audit snapshots. Deleted account identifiers remain reserved to prevent a new account from inheriting historical ownership.

Booking and account changes append audit records in the same database transaction. Logs show the acting admin, target, time in Asia/Manila and safe before/after changes; password resets only record that a reset occurred. Existing pre-audit activity is not fabricated. The portal has no housekeeping, check-in, POS or payroll functions.

`/receipt` renders only the session-owned saved booking. It combines demo payment details, internal transaction/reference/date, the room photo and stay/price breakdown in a compact receipt. Recorded amounts stay in PHP; other selected currencies appear only as an estimate. The print stylesheet requests 105 × 240 mm paper with zero margins. Use the receipt's Print button and the browser's paper settings; actual printer margins depend on the device. The receipt shows booking/cancellation status and explicitly states that no payment was collected, with hotel confirmation pending. It is not proof of a real payment.

Review uses the supplied dark payment layout: Apple Pay and Google Pay buttons, an OR divider, and card-number, expiration-date and security-code inputs. Card preview supports Visa, Mastercard, American Express and Discover test numbers. GCash, Maya and bank transfer are no longer offered; historic records retain readable method labels. The browser validates test details and sends only the method ID to the server. Card number, expiry and security code have no form names and never enter API payloads, storage or logs. The remember-method checkbox saves only the selected method ID in this device's local storage. No gateway SDK, authorization or real charge is performed. See `public/payment-logos/SOURCES.md` for artwork provenance. A future production integration must replace these test inputs with provider-hosted fields, payment intents and verified webhooks.

Signed-in guests have a header notification bell. Saving or cancelling their account bookings creates a persisted notification in the same database transaction. Confirmation retries and repeated cancellation do not duplicate notices. Guests without accounts have no bell and cannot access notification APIs. Read status is scoped to the signed-in account; the panel refreshes on opening and every minute while the page is visible. It is an in-app inbox, not push/email/SMS messaging.

The guest interface follows the existing ivory/green identity with self-hosted Cormorant Garamond and Manrope, a date-search landing page and room previews sourced from the local catalog. See `DESIGN.md` for the shared visual rules. Font licenses are included in `public/fonts/`; hotel photography is illustrative.

Room results group matching rooms by property, type, capacity and nightly rate. Guests can update dates, filter room types and sort prices/capacity. Both nightly rates and the estimated whole-stay total are shown before room selection; the server recalculates the final amount during booking.

The guest-details and review pages keep a shared room/date/price summary, preserve entered details when going back to edit, and clearly separate demo payment from real hotel confirmation. The booking result includes its reference, printing, cancellation and reference copying. My Booking uses the same visual system and keeps errors recoverable without clearing the form.

Keep XianFire, `.xian` views and Tailwind. Complete and verify one feature, then commit it before starting a different feature. For example, an explicitly requested login feature and registration feature should have separate commits after each works; these examples do not add those features to the current scope.

Use `npm run build`, `npm test` and `npm run route:list` as applicable. The integration tests create an isolated `online_booking_test_TIMESTAMP` MySQL database and delete only that named test database afterward. They verify that other systems' endpoints are absent, as well as guest validation, pricing, local payments, concurrency, booking ownership, lookup, cancellation and session persistence.

Use meaningful commit messages and review staged files. Keep `.env`, dependencies, runtime data and generated screenshots out of commits. Local commits are separate from pushing to GitHub.

The header uses readable 16px navigation/controls with an 18px body, independent language and currency selectors, one My StayBook link and header sign-out. Sign-in/registration omit hotel navigation, currency and footer, keeping only the brand, language selector and guest back link. The landing photo extends across the hero down to the search section.
