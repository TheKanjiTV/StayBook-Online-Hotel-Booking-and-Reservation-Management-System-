import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from './client.js';
import { Sequelize } from 'sequelize';
import { randomUUID } from 'node:crypto';
process.env.HOST = '127.0.0.1';
process.env.DB_NAME = `online_booking_test_${Date.now()}`;
const { migrate } = await import('../migrate.js');
const { sequelize } = await import('../models/db.js');
const { Reservation, Payment } = await import('../models/bookingModel.js');
const { config } = await import('../config.js');
const { startServer } = await import('../index.js');
const { today } = await import('../services/validation.js');
await test('Online booking scope and guest review', async t => {
  let server;
  const dates = { checkIn: today(), checkOut: new Date(Date.parse(today()) + 86400000).toISOString().slice(0, 10), guests: 2 };
  try {
    await migrate(); server = await startServer(0);
    const guest = new Client(`http://127.0.0.1:${server.address().port}`);
    await t.test('Only guest booking pages and APIs are available', async () => {
      const home = await guest.call('/'); assert.ok(!home.includes('Staff portal'));
      for (const path of ['/staff', '/login', '/api/pms/overview', '/api/housekeeping', '/api/pos', '/api/hr', '/api/events']) await guest.call(path, 'GET', undefined, 404);
      const data = await guest.call(`/rooms/search?${new URLSearchParams(dates)}`); assert.equal(data.rooms.length, 6);
    });
    await t.test('Invalid dates and forged prices cannot affect the reservation review', async () => {
      await guest.call('/rooms/search?checkIn=2026-02-30&checkOut=2026-03-02&guests=2', 'GET', undefined, 400);
      const body = { ...dates, roomId: 1, firstName: 'Test', lastName: 'Guest', email: 'guest@example.test', phone: '09123456789', totalAmount: 1 };
      await guest.call('/booking/preview', 'POST', body, 403, { 'x-csrf-token': 'wrong' });
      await guest.call('/booking/preview', 'POST', { ...body, guests: 5 }, 400);
      await guest.call('/booking/preview', 'POST', body);
      const { booking } = await guest.call('/api/booking-preview'); assert.equal(booking.totalAmount, 2500);
      const html = await guest.call('/confirmation'); assert.ok(html.includes('/confirmation.js'));
      const other = new Client(guest.base); await other.call('/'); await other.call('/api/booking-preview', 'GET', undefined, 404);
    });
    await t.test('Simulated payment and local reservation commit together with safe retries', async () => {
      await guest.call('/api/bookings/confirm', 'POST', { simulateFailure: true }, 402);
      assert.equal(await Reservation.count(), 0); assert.equal(await Payment.count(), 0);
      const data = await guest.call('/api/bookings/confirm', 'POST', { totalAmount: 1 });
      assert.equal(data.reservation.status, 'LOCAL_CONFIRMED'); assert.equal(Number(data.reservation.total_amount), 2500);
      assert.equal(data.reservation.integration_status, 'NOT_CONNECTED');
      const again = await guest.call('/api/bookings/confirm', 'POST', {});
      assert.equal(again.reservation.reservation_id, data.reservation.reservation_id);
      assert.equal(await Reservation.count(), 1); assert.equal(await Payment.count(), 1);
      const other = new Client(guest.base); await other.call('/'); assert.equal((await other.call('/api/bookings/current')).reservation, null);
    });
    await t.test('Guest details use the server quote and preserve guest information when editing', async () => {
      await guest.call('/guest-details', 'GET', undefined, 302);
      const query = new URLSearchParams({ ...dates, roomId: 1, price: 1, totalAmount: 1 });
      const html = await guest.call(`/guest-details?${query}`);
      assert.ok(html.includes('₱2,500.00')); assert.ok(html.includes('value="Test"'));
      await guest.call(`/guest-details?${new URLSearchParams({ ...dates, roomId: 'invalid' })}`, 'GET', undefined, 400);
    });
    await t.test('Concurrent local reservations prevent overlapping bookings', async () => {
      const clients = [new Client(guest.base), new Client(guest.base)];
      for (const c of clients) { await c.call('/'); await c.call('/booking/preview', 'POST', { ...dates, roomId: 2, firstName: 'Concurrent', lastName: 'Guest', email: 'concurrent@example.test', phone: '09123456789' }); }
      const statuses = await Promise.all(clients.map(async c => {
        const response = await fetch(c.base + '/api/bookings/confirm', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': c.csrf, cookie: [...c.cookies].map(([k,v]) => `${k}=${v}`).join('; ') }, body: '{}' });
        await response.text(); return response.status;
      }));
      assert.deepEqual(statuses.sort(), [200, 409]);
      const available = await guest.call(`/rooms/search?${new URLSearchParams(dates)}`); assert.ok(!available.rooms.some(r => r.id === 1 || r.id === 2));
    });
    await t.test('Saved bookings and sessions survive a server restart', async () => {
      const before = (await guest.call('/api/bookings/current')).reservation;
      const port = server.address().port; await new Promise(resolve => server.close(resolve)); server = await startServer(port);
      const after = (await guest.call('/api/bookings/current')).reservation; assert.equal(after.reference, before.reference);
    });
    await t.test('Booking lookup restores access and cancellation refunds only local simulated payments', async () => {
      const booking = (await guest.call('/api/bookings/current')).reservation;
      const lookup = new Client(guest.base); await lookup.call('/manage-booking');
      await lookup.call('/api/bookings/cancel', 'POST', {}, 404);
      await lookup.call('/api/bookings/lookup', 'POST', { reference: booking.reference, email: 'wrong@example.test' }, 404);
      await lookup.call('/api/bookings/lookup', 'POST', { reference: booking.reference, email: 'guest@example.test' });
      assert.equal((await lookup.call('/api/bookings/current')).reservation.reference, booking.reference);
      await lookup.call('/api/bookings/cancel', 'POST', {}); await lookup.call('/api/bookings/cancel', 'POST', {});
      const cancelled = (await lookup.call('/api/bookings/current')).reservation;
      assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.payments[0].payment_status, 'REFUNDED');
      const available = await guest.call(`/rooms/search?${new URLSearchParams(dates)}`); assert.ok(available.rooms.some(r => r.id === 1));
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await sequelize.close();
    assert.match(config.dbName, /^online_booking_test_\d+$/);
    const cleanup = new Sequelize('mysql', config.dbUser, config.dbPassword, { host: config.dbHost, port: config.dbPort, dialect: 'mysql', logging: false });
    try { await cleanup.query(`DROP DATABASE IF EXISTS \`${config.dbName}\``); } finally { await cleanup.close(); }
  }
});
