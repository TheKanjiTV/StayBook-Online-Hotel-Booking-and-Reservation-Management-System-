import test from 'node:test';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { Client } from './client.js';
process.env.DB_NAME = `online_booking_management_test_${Date.now()}`;
const { migrate } = await import('../migrate.js');
const { sequelize } = await import('../models/db.js');
const { config } = await import('../config.js');
const { Account, Notification } = await import('../models/accountModel.js');
const { Reservation, Payment } = await import('../models/bookingModel.js');
const { AuditLog } = await import('../models/auditModel.js');
const { register } = await import('../services/accountService.js');
const { startServer } = await import('../index.js');
const { today } = await import('../services/validation.js');
const day = offset => new Date(Date.parse(today()) + offset * 86400000).toISOString().slice(0, 10);
await test('Admin booking and account management', async t => {
  let server;
  try {
    await migrate(); server = await startServer(0);
    const password = 'management-example-password';
    const administrator = await register({ firstName: 'Primary', lastName: 'Admin', email: 'management-admin@example.test', password });
    await Account.update({ role: 'ADMIN' }, { where: { account_id: administrator.id } });
    await register({ firstName: 'Booking', lastName: 'Owner', email: 'management-owner@example.test', password });
    const admin = new Client(`http://127.0.0.1:${server.address().port}`), owner = new Client(admin.base);
    for (const [client, email] of [[admin, administrator.email], [owner, 'management-owner@example.test']]) { await client.call('/sign-in'); await client.call('/api/auth/sign-in', 'POST', { email, password }); await client.call(client === admin ? '/admin' : '/account'); }
    await t.test('Confirm, edit and delete preserve availability, pricing, audit history and ownership', async () => {
      const input = { checkIn: day(50), checkOut: day(51), roomId: 1, guests: 2, firstName: 'Booking', lastName: 'Owner', email: 'management-owner@example.test', phone: '09123456789' };
      await owner.call('/booking/preview', 'POST', input);
      const { reservation } = await owner.call('/api/bookings/confirm', 'POST', { paymentMethod: 'VISA' }); const id = reservation.reservation_id;
      await owner.call(`/api/admin/bookings/${id}/confirm`, 'POST', {}, 403);
      await admin.call(`/api/admin/bookings/${id}/confirm`, 'POST', {}); await admin.call(`/api/admin/bookings/${id}/confirm`, 'POST', {});
      assert.equal((await Reservation.findByPk(id)).status, 'ADMIN_CONFIRMED');
      assert.equal(await AuditLog.count({ where: { action: 'BOOKING_CONFIRMED', target_id: id } }), 1);
      assert.ok(!(await owner.call(`/rooms/search?${new URLSearchParams(input)}`)).rooms.some(room => room.id === 1));
      const previous = await Reservation.findByPk(id);
      const edit = { ...input, firstName: 'Updated', roomId: 3, guests: 3, checkIn: day(51), checkOut: day(53), totalAmount: 1, version: previous.version };
      await admin.call(`/api/admin/bookings/${id}/update`, 'POST', edit);
      const updated = await Reservation.findByPk(id); assert.equal(Number(updated.total_amount), 7000); assert.equal(updated.status, 'LOCAL_CONFIRMED'); assert.equal(updated.first_name, 'Updated');
      assert.equal(Number((await Payment.findOne({ where: { reservation_id: id } })).amount), 7000);
      await admin.call(`/api/admin/bookings/${id}/update`, 'POST', edit, 409);
      assert.equal(await Notification.count({ where: { reservation_id: id, kind: 'BOOKING_UPDATED' } }), 1);
      await admin.call(`/api/admin/bookings/${id}/confirm`, 'POST', {});
      await admin.call(`/api/admin/bookings/${id}/delete`, 'POST', {});
      assert.equal(await Reservation.findByPk(id), null); assert.ok((await Reservation.findByPk(id, { paranoid: false })).deletedAt);
      assert.equal((await Payment.findOne({ where: { reservation_id: id } })).payment_status, 'REFUNDED');
      await owner.call('/api/bookings/current', 'GET', undefined, 404);
      assert.equal(await AuditLog.count({ where: { action: 'BOOKING_DELETED', target_id: id } }), 1);
      assert.ok((await owner.call(`/rooms/search?${new URLSearchParams({checkIn: day(51),checkOut: day(53),guests:3})}`)).rooms.some(room => room.id === 3));
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve)); await sequelize.close();
    assert.match(config.dbName, /^online_booking_management_test_\d+$/);
    const cleanup = new Sequelize('mysql', config.dbUser, config.dbPassword, { host: config.dbHost, port: config.dbPort, dialect: 'mysql', logging: false });
    try { await cleanup.query(`DROP DATABASE IF EXISTS \`${config.dbName}\``); } finally { await cleanup.close(); }
  }
});
