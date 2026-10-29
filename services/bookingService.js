import { randomBytes, randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';
import { BookingRoom, Reservation, Payment } from '../models/bookingModel.js';
import { searchInput, guestInput, positiveId, fail, string, hash, cents, amount } from './validation.js';
export async function saveBooking(body) {
  const dates = searchInput(body), guest = guestInput(body), roomId = positiveId(body.roomId, 'room');
  const requestKey = string(body.requestKey, 'Request key');
  const requestHash = hash({ dates, guest, roomId });
  return sequelize.transaction(async transaction => {
    const room = await BookingRoom.findByPk(roomId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) fail(404, 'Room not found.');
    const existing = await Reservation.findOne({ where: { request_key: requestKey }, transaction });
    if (existing) { if (existing.request_hash !== requestHash) fail(409, 'This request key was already used for different details.'); return existing; }
    if (dates.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    const conflict = await Reservation.findOne({ where: { room_id: roomId, status: 'LOCAL_CONFIRMED', check_in: { [Op.lt]: dates.checkOut }, check_out: { [Op.gt]: dates.checkIn } }, transaction });
    if (conflict) fail(409, 'This sample room is already booked for those dates. Choose another room.');
    if (body.simulateFailure === true) fail(402, 'Simulated payment failed. No booking was saved. Please retry.');
    const total = amount(cents(room.price) * dates.nights);
    const booking = await Reservation.create({ ...guest, reference: `SB-${randomBytes(6).toString('hex').toUpperCase()}`, request_key: requestKey, request_hash: requestHash, access_token: randomBytes(32).toString('hex'),
      room_id: roomId, room_name: room.name, room_number: room.room_number, room_type: room.type, check_in: dates.checkIn, check_out: dates.checkOut,
      guests: dates.guests, nights: dates.nights, nightly_rate: room.price, total_amount: total, status: 'LOCAL_CONFIRMED' }, { transaction });
    await Payment.create({ reservation_id: booking.reservation_id, amount: total, payment_method: 'SIMULATED', payment_status: 'PAID', paid_at: new Date(), reference: randomUUID(), purpose: 'BOOKING' }, { transaction });
    // TODO: send the agreed reservation payload to the PMS API in a later phase.
    // A locally saved booking must not be presented as acknowledged by the PMS.
    return booking;
  });
}
export async function getBooking(id, token) {
  const booking = await Reservation.findOne({ where: { reservation_id: positiveId(id), access_token: token } });
  if (!booking) fail(404, 'Booking not found.');
  const payments = await Payment.findAll({ where: { reservation_id: booking.reservation_id }, attributes: ['amount', 'payment_method', 'payment_status', 'paid_at', 'purpose'] });
  const data = booking.toJSON(); delete data.access_token; delete data.request_key; delete data.request_hash;
  return { ...data, guest: { first_name: data.first_name, last_name: data.last_name, email: data.email },
    room: { room_number: data.room_number, roomType: { name: data.room_type } }, payments, integration_status: 'NOT_CONNECTED' };
}
