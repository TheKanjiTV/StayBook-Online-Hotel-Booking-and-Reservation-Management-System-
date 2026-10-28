# StayBook
### Online Hotel Booking and Reservation Management System

StayBook is a web-based hotel booking project developed with **XianFire (Node.js/Express)**, **JavaScript**, **Tailwind CSS**, **Sequelize**, and **MySQL**. It is intended to provide a straightforward guest booking experience and eventually integrate with a Property Management System (PMS) through APIs and events.

> **Development status:** The current booking flow is a prototype using sample room data and a session-based reservation preview. It does **not** yet create a confirmed PMS reservation or process payments.

## Features

### Implemented in the prototype
- Responsive hotel landing page
- Room search by check-in date, check-out date, and guest count
- Basic input and date validation
- Room cards with descriptions, occupancy, and nightly rates
- Guest information form
- Server-calculated stay duration and estimated total
- Session-based reservation preview and review page

### Planned integration
- Live room inventory and date-range availability from the PMS
- Reservation creation with protection against double booking
- Payment processing and verification
- PMS reservation confirmation and `RoomBooked` event
- Booking status tracking and cancellation

## Technology Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | XianFire / Express |
| Templates | `.xian` views |
| Frontend | HTML, Tailwind CSS, JavaScript |
| Database | MySQL |
| ORM | Sequelize |
| API communication | HTTP / Fetch API |

## Booking Flow

```text
Home
  ↓
Search rooms (check-in, check-out, guests)
  ↓
Browse room results
  ↓
Select a room
  ↓
Enter guest details
  ↓
Review reservation preview
  ↓
[Future] PMS availability recheck → reservation → payment → confirmation
```

**Note:** The current room search filters sample rooms by guest capacity; it does not yet verify availability against existing bookings for the selected dates.

## Project Structure

The planned/current development layout includes:

```text
online-booking/
├── controllers/
│   └── bookingController.js
├── models/
│   ├── db.js
│   └── userModel.js
├── routes/
│   └── index.js
├── services/
│   └── pmsApi.js
├── views/
│   ├── home.xian
│   ├── rooms.xian
│   ├── guest-details.xian
│   └── confirmation.xian
├── public/
├── index.js
├── migrate.js
├── package.json
└── README.md
```

> File names and folders should be checked against the current repository as development continues.

## Getting Started

### Requirements
- Node.js and npm
- MySQL server (e.g., via Laragon)
- Git (optional)

### 1. Clone the repository

```bash
git clone https://github.com/TheKanjiTV/StayBook-Online-Hotel-Booking-and-Reservation-Management-System-.git
cd StayBook-Online-Hotel-Booking-and-Reservation-Management-System-
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure MySQL

Start MySQL and configure the database connection in `models/db.js` (or the environment variables used by your project).

Suggested local database name:

```text
online_booking
```

Avoid committing real passwords or session secrets. Database names containing hyphens must be quoted in MySQL SQL statements.

### 4. Run database setup

```bash
npm run migrate
```

Review `migrate.js` before running it. **Do not use `sequelize.sync({ force: true })` on a database containing important data**, because it can drop and recreate tables.

### 5. Start the application

Check the scripts in `package.json` and run the appropriate start command, for example:

```bash
npm run dev
```

Open the local URL printed by the application.

## Application Routes

The prototype is designed around these routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | Home page |
| `GET` | `/rooms` | Room results page |
| `GET` | `/rooms/search` | Search sample rooms |
| `GET` | `/guest-details` | Guest details page |
| `POST` | `/booking/preview` | Validate guest details and create preview |
| `GET` | `/confirmation` | Reservation review page |
| `GET` | `/api/booking-preview` | Retrieve the session's preview |

Example search:

```http
GET /rooms/search?checkIn=2026-11-01&checkOut=2026-11-03&guests=2
```

## PMS Integration Plan

The Online Booking module will request room availability and reservation services from the PMS. The PMS should remain the authoritative source for room inventory and reservation status.

```text
Guest → StayBook UI → Booking Controller → PMS API
                                          ↓
                                    PMS Database
                                          ↓
                             Reservation confirmed
                                          ↓
                                   RoomBooked event
```

A confirmed booking must only be shown after the PMS has successfully created/confirmed the reservation under the agreed payment workflow. A preview alone is not a booking confirmation.

## Development Notes

- Validate input on both client and server.
- Recheck date-range availability when creating a reservation.
- Do not trust room prices or totals supplied by the browser.
- Do not store payment card details directly.
- Keep `.env`, secrets, and `node_modules/` out of Git.
- Replace development session storage and the Tailwind Play CDN with production-ready alternatives before deployment.

## Project Status

**In development** — guest-facing booking prototype and PMS integration planning.

## Repository

**Maintainer:** [TheKanjiTV](https://github.com/TheKanjiTV)

This repository is part of an event-driven hotel systems development project.
