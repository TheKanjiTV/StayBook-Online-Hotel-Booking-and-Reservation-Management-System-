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
      const home = await guest.call('/'); assert.ok(!home.includes('Staff portal')); assert.ok(home.includes('data-booking-hub href="/manage-booking"')); assert.ok(!home.includes('href="/account"')); assert.ok(!home.includes('data-sign-out')); assert.ok(home.includes('class="nav-link header-signin" href="/sign-in"'));
      assert.ok((await guest.call('/manage-booking')).includes('Sign in to view your account bookings'));
      for (const path of ['/staff', '/login', '/api/pms/overview', '/api/housekeeping', '/api/pos', '/api/hr', '/api/events']) await guest.call(path, 'GET', undefined, 404);
      const data = await guest.call(`/rooms/search?${new URLSearchParams(dates)}`); assert.equal(data.rooms.length, 6);
    });
    await t.test('Hotel directory filters rooms by their sample property', async () => {
      const directory = await guest.call('/hotels'); assert.ok(directory.includes('StayBook City Hotel')); assert.ok(!directory.includes('Restaurants &amp; Bars'));
      const first = await guest.call(`/rooms/search?${new URLSearchParams({ ...dates, hotelId: 1 })}`);
      assert.equal(first.rooms.length, 3); assert.ok(first.rooms.every(room => room.hotel.id === 1));
      const second = await guest.call(`/rooms/search?${new URLSearchParams({ ...dates, hotelId: 2 })}`);
      assert.equal(second.rooms.length, 3); assert.ok(second.rooms.every(room => room.hotel.id === 2));
      assert.equal((await guest.call(`/rooms/search?${new URLSearchParams({ ...dates, hotelId: 999 })}`)).rooms.length, 0);
    });
    await t.test('Account entry pages use the standalone brand and language layout', async () => {
      for (const path of ['/sign-in', '/join']) {
        const html = await guest.call(path);
        assert.ok(html.includes('class="brand"')); assert.ok(html.includes('id="languageSelect"')); assert.ok(html.includes('Continue as a guest'));
        assert.ok(!html.includes('class="site-header')); assert.ok(!html.includes('class="site-footer')); assert.ok(!html.includes('id="currencySelect"'));
      }
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
    await t.test('Compact receipts show the room photo and honest payment/confirmation status', async () => {
      const booking = (await guest.call('/api/bookings/current')).reservation;
      const html = await guest.call('/receipt');
      assert.ok(html.includes(booking.reference)); assert.ok(html.includes('Booking cancelled'));
      assert.ok(html.includes('class="receipt-photo"')); assert.ok(html.includes('PHP')); assert.ok(html.includes('No payment has been collected.'));
      assert.ok(!/demo|simulated/i.test(html));
      const visitor = new Client(guest.base); await visitor.call(`/receipt?reservationId=${booking.reservation_id}`, 'GET', undefined, 302);
    });
    await t.test('Language and currency preferences persist and never change PHP booking totals', async () => {
      const client = new Client(guest.base); await client.call('/');
      await client.call('/api/preferences', 'POST', { language: 'fil' });
      let html = await client.call('/'); assert.ok(html.includes('lang="fil"')); assert.ok(html.includes('data-currency="PHP"'));
      await client.call('/api/preferences', 'POST', { language: 'unsupported' }, 400);
      await client.call('/api/preferences', 'POST', { currency: 'BAD' }, 400);
      const { languages, dictionary } = await import('../public/translations.js');
      assert.equal(languages.length, 9); for (const values of Object.values(dictionary)) assert.equal(values.length, 8);
      await client.call('/api/preferences', 'POST', { language: 'ar' });
      html = await client.call('/'); assert.ok(html.includes('dir="rtl"')); assert.ok(html.includes('data-currency="AED"'));
      await client.call('/api/preferences', 'POST', { currency: 'JPY' });
      html = await client.call('/'); assert.ok(html.includes('lang="ar"')); assert.ok(html.includes('data-currency="JPY"'));
      if (config.exchangeRateApiKey) {
        const { exchangeRates } = await import('../services/preferences.js');
        const rates = await exchangeRates(); assert.equal(rates.provider, 'standard');
        assert.ok(!html.includes(config.exchangeRateApiKey)); assert.ok(!JSON.stringify(rates).includes(config.exchangeRateApiKey));
      }
      const { reservation } = await guest.call('/api/bookings/current'); assert.equal(Number(reservation.total_amount), 2500);
    });
    await t.test('Guest accounts rotate sessions and restrict booking ownership', async () => {
      const member = new Client(guest.base), stranger = new Client(guest.base);
      await member.call('/join');
      const oldCookie = member.cookies.get('staybook.sid');
      const credentials = { firstName: 'Member', lastName: 'Guest', email: 'member@example.test', password: 'example-test-password' };
      await member.call('/api/auth/register', 'POST', { ...credentials, password: 'short' }, 400);
      await member.call('/api/auth/register', 'POST', credentials);
      assert.notEqual(member.cookies.get('staybook.sid'), oldCookie);
      assert.ok((await member.call('/account')).includes('href="/account"'));
      assert.equal((await member.call('/api/account/bookings')).bookings.length, 0);
      await member.call('/booking/preview', 'POST', { ...dates, roomId: 3, ...credentials, phone: '09123456789' });
      const { reservation } = await member.call('/api/bookings/confirm', 'POST', { accountId: 999 });
      assert.equal((await member.call('/api/account/bookings')).bookings[0].reservation_id, reservation.reservation_id);
      await stranger.call('/sign-in'); await stranger.call('/api/account/bookings', 'GET', undefined, 401);
      await stranger.call('/api/auth/register', 'POST', { ...credentials, email: 'other@example.test' }); await stranger.call('/account');
      await stranger.call('/api/account/bookings/open', 'POST', { reservationId: reservation.reservation_id }, 404);
      await member.call('/api/auth/sign-out', 'POST', {}); await member.call('/sign-in');
      await member.call('/api/auth/sign-in', 'POST', { email: credentials.email, password: 'incorrect' }, 401);
      await member.call('/api/auth/sign-in', 'POST', credentials); await member.call('/account');
      await member.call('/api/account/bookings/open', 'POST', { reservationId: reservation.reservation_id });
      assert.equal((await member.call('/api/bookings/current')).reservation.reference, reservation.reference);
      const { Account } = await import('../models/accountModel.js');
      assert.ok(!(await Account.findOne({ where: { email: credentials.email } })).password_hash.includes(credentials.password));
    });
    await t.test('Username migration preserves accounts and supports username or email sign in', async () => {
      assert.match(config.dbName, /^online_booking_test_\d+$/);
      const { Account } = await import('../models/accountModel.js');
      const account = await Account.findOne({ where: { email: 'member@example.test' } });
      const passwordHash = account.password_hash;
      await sequelize.getQueryInterface().removeColumn(Account.getTableName(), 'username');
      await migrate(); await migrate();
      await account.reload(); assert.equal(account.password_hash, passwordHash);
      await account.update({ username: 'member-login' });
      const client = new Client(guest.base); await client.call('/sign-in');
      await client.call('/api/auth/sign-in', 'POST', { email: 'missing-username', password: 'example-test-password' }, 401);
      await client.call('/api/auth/sign-in', 'POST', { email: 'member-login', password: 'incorrect' }, 401);
      await client.call('/api/auth/sign-in', 'POST', { email: ' MEMBER-LOGIN ', password: 'example-test-password' });
      const memberPage = await client.call('/account'); assert.ok(memberPage.includes('Welcome, Member.')); assert.ok(!memberPage.includes('header-signin'));
      await client.call('/api/auth/sign-out', 'POST', {}); await client.call('/sign-in');
      await client.call('/api/auth/sign-in', 'POST', { email: account.email, password: 'example-test-password' });
      await client.call('/account');
    });
    await t.test('Demo payment methods persist without accepting unsupported methods or changing totals', async () => {
      const { paymentMethods } = await import('../public/payment-methods.js');
      const client = new Client(guest.base); await client.call('/');
      for (const [index, method] of paymentMethods.entries()) {
        const ci = new Date(Date.parse(today()) + (index + 10) * 86400000).toISOString().slice(0, 10);
        const co = new Date(Date.parse(ci) + 86400000).toISOString().slice(0, 10);
        await client.call('/booking/preview', 'POST', { checkIn: ci, checkOut: co, guests: 2, roomId: 6, firstName: 'Method', lastName: 'Test', email: 'method@example.test', phone: '09123456789' });
        await client.call('/api/bookings/confirm', 'POST', { paymentMethod: 'UNSUPPORTED' }, 400);
        await client.call('/api/bookings/confirm', 'POST', { paymentMethod: method.id, simulateFailure: true }, 402);
        const { reservation } = await client.call('/api/bookings/confirm', 'POST', { paymentMethod: method.id, totalAmount: 1 });
        assert.equal(reservation.payments[0].payment_method, method.id); assert.equal(Number(reservation.total_amount), 5000);
        const again = await client.call('/api/bookings/confirm', 'POST', { paymentMethod: method.id }); assert.equal(again.reservation.reference, reservation.reference);
        await client.call('/api/bookings/confirm', 'POST', { paymentMethod: paymentMethods[(index + 1) % paymentMethods.length].id }, 409);
      }
    });
    await t.test('Only account owners receive persisted booking notifications with safe retries', async () => {
      const member = new Client(guest.base), other = new Client(guest.base);
      const plainHome = await other.call('/'); assert.ok(!plainHome.includes('id="notificationBadge"'));
      await other.call('/api/account/notifications', 'GET', undefined, 401);
      await member.call('/join');
      await member.call('/api/auth/register', 'POST', { firstName: 'Notify', lastName: 'Guest', email: 'notify@example.test', password: 'notification-test-pass' });
      assert.ok((await member.call('/account')).includes('id="notificationBadge"'));
      assert.equal((await member.call('/api/account/notifications')).unread, 0);
      await member.call('/booking/preview', 'POST', { ...dates, roomId: 4, firstName: 'Notify', lastName: 'Guest', email: 'notify@example.test', phone: '09123456789' });
      await member.call('/api/bookings/confirm', 'POST', {}); await member.call('/api/bookings/confirm', 'POST', {});
      let data = await member.call('/api/account/notifications'); assert.equal(data.unread, 1); assert.equal(data.notifications.length, 1);
      await other.call('/api/auth/register', 'POST', { firstName: 'Other', lastName: 'Guest', email: 'notify-other@example.test', password: 'notification-test-pass' }); await other.call('/account');
      await other.call('/api/account/notifications/read', 'POST', { notificationId: data.notifications[0].notification_id });
      assert.equal((await member.call('/api/account/notifications')).unread, 1);
      await member.call('/api/account/notifications/read', 'POST', {}); assert.equal((await member.call('/api/account/notifications')).unread, 0);
      await member.call('/api/bookings/cancel', 'POST', {}); await member.call('/api/bookings/cancel', 'POST', {});
      data = await member.call('/api/account/notifications'); assert.equal(data.unread, 1); assert.equal(data.notifications.length, 2); assert.equal(data.notifications[0].kind, 'BOOKING_CANCELLED');
    });
    await t.test('Admin roles default safely and portal access follows the current database role', async () => {
      const { Account } = await import('../models/accountModel.js');
      assert.match(config.dbName, /^online_booking_test_\d+$/);
      await sequelize.getQueryInterface().removeColumn(Account.getTableName(), 'role');
      await migrate(); await migrate();
      assert.equal(await Account.count({ where: { role: 'ADMIN' } }), 0);
      const anonymous = new Client(guest.base), member = new Client(guest.base);
      await anonymous.call('/'); await anonymous.call('/admin', 'GET', undefined, 302);
      await anonymous.call('/admin/bookings/1', 'GET', undefined, 302);
      await anonymous.call('/api/admin/bookings/1/cancel', 'POST', {}, 401);
      await member.call('/join');
      const created = await member.call('/api/auth/register', 'POST', { firstName: 'Portal', lastName: 'Guest', email: 'portal-guest@example.test', password: 'portal-test-password', role: 'ADMIN', isAdmin: true });
      assert.equal(created.redirect, '/account');
      assert.equal((await Account.findOne({ where: { email: 'portal-guest@example.test' } })).role, 'GUEST');
      await member.call('/admin', 'GET', undefined, 403);
      await member.call('/admin/bookings/1', 'GET', undefined, 403);
      await member.call('/api/admin/bookings/1/cancel', 'POST', { role: 'ADMIN' }, 403);
      const account = await Account.findOne({ where: { username: 'member-login' } });
      await account.update({ role: 'ADMIN' });
      const admin = new Client(guest.base); await admin.call('/sign-in');
      assert.equal((await admin.call('/api/auth/sign-in', 'POST', { email: 'member-login', password: 'example-test-password' })).redirect, '/admin');
      assert.ok((await admin.call('/admin')).includes('Dashboard'));
      await admin.call('/account', 'GET', undefined, 302);
      await account.update({ role: 'GUEST' });
      await admin.call('/admin', 'GET', undefined, 403);
      await admin.call('/api/admin/bookings/1/cancel', 'POST', {}, 403);
    });
    await t.test('Admins search all bookings and cancel without exposing booking secrets or duplicating notifications', async () => {
      const { Account, Notification } = await import('../models/accountModel.js');
      const account = await Account.findOne({ where: { username: 'member-login' } });
      await account.update({ role: 'ADMIN' });
      const admin = new Client(guest.base); await admin.call('/sign-in');
      await admin.call('/api/auth/sign-in', 'POST', { email: account.email, password: 'example-test-password' });
      const owner = new Client(guest.base); await owner.call('/sign-in');
      await owner.call('/api/auth/sign-in', 'POST', { email: 'portal-guest@example.test', password: 'portal-test-password' });
      await owner.call('/account');
      const checkIn = new Date(Date.parse(today()) + 40 * 86400000).toISOString().slice(0, 10), checkOut = new Date(Date.parse(checkIn) + 86400000).toISOString().slice(0, 10);
      await owner.call('/booking/preview', 'POST', { checkIn, checkOut, guests: 2, roomId: 2, firstName: 'Portal', lastName: 'Guest', email: 'portal-guest@example.test', phone: '09123456789' });
      const { reservation } = await owner.call('/api/bookings/confirm', 'POST', { paymentMethod: 'VISA' });
      const id = reservation.reservation_id, stored = await Reservation.findByPk(id);
      const html = await admin.call(`/admin/bookings?q=${reservation.reference}`);
      assert.ok(html.includes(reservation.reference)); assert.ok(!html.includes(stored.access_token)); assert.ok(!html.includes(stored.request_hash));
      assert.ok((await admin.call(`/admin/bookings/${id}`)).includes('portal-guest@example.test'));
      await admin.call('/admin/bookings?status=INVALID', 'GET', undefined, 400);
      await admin.call('/admin/bookings?page=0', 'GET', undefined, 400);
      await admin.call('/admin/bookings/not-an-id', 'GET', undefined, 400);
      await admin.call('/admin/bookings/99999999', 'GET', undefined, 404);
      assert.ok((await admin.call('/admin/bookings?q=NO-SUCH-REFERENCE')).includes('No bookings found'));
      await admin.call(`/api/admin/bookings/${id}/cancel`, 'POST', {}, 403, { 'x-csrf-token': 'invalid' });
      await admin.call(`/api/admin/bookings/${id}/cancel`, 'POST', {});
      await admin.call(`/api/admin/bookings/${id}/cancel`, 'POST', {});
      assert.equal((await owner.call('/api/bookings/current')).reservation.status, 'CANCELLED');
      assert.equal(await Notification.count({ where: { reservation_id: id, kind: 'BOOKING_CANCELLED' } }), 1); const { AuditLog } = await import('../models/auditModel.js'); assert.equal(await AuditLog.count({ where: { target_id: id, action: 'BOOKING_CANCELLED' } }), 1); assert.ok((await admin.call('/admin/audit-logs')).includes(reservation.reference));
      assert.equal((await Payment.findOne({ where: { reservation_id: id } })).payment_status, 'REFUNDED');
      assert.equal((await Reservation.findByPk(id)).total_amount, stored.total_amount);
      assert.ok(!(await admin.call(`/admin/bookings?status=LOCAL_CONFIRMED&q=${reservation.reference}`)).includes(`href="/admin/bookings/${id}"`));
      assert.ok((await admin.call(`/admin/bookings?status=CANCELLED&q=${reservation.reference}`)).includes(`href="/admin/bookings/${id}"`));
      await account.update({ role: 'GUEST' });
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await sequelize.close();
    assert.match(config.dbName, /^online_booking_test_\d+$/);
    const cleanup = new Sequelize('mysql', config.dbUser, config.dbPassword, { host: config.dbHost, port: config.dbPort, dialect: 'mysql', logging: false });
    try { await cleanup.query(`DROP DATABASE IF EXISTS \`${config.dbName}\``); } finally { await cleanup.close(); }
  }
});
