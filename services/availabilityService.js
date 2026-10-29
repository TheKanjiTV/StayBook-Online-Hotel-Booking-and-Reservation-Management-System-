import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';
import { BookingRoom, Reservation, activeBookingStatuses } from '../models/bookingModel.js';
import { BookingClosure } from '../models/availabilityModel.js';
import { positiveId, string, searchInput, fail } from './validation.js';
import { recordAudit } from './auditService.js';
export async function closeBookingDates(body, actor) {
  const roomId = positiveId(body.roomId, 'room'), dates = searchInput({ checkIn: body.start, checkOut: body.end, guests: 1 }), reason = string(body.reason, 'Reason', 200);
  return sequelize.transaction(async transaction => {
    const room = await BookingRoom.findByPk(roomId, { transaction, lock: transaction.LOCK.UPDATE }); if (!room) fail(404, 'Room not found.');
    const occupied = await Reservation.findOne({ where: { room_id: roomId, status: { [Op.in]: activeBookingStatuses }, check_in: { [Op.lt]: dates.checkOut }, check_out: { [Op.gt]: dates.checkIn } }, transaction, lock: transaction.LOCK.UPDATE });
    if (occupied) fail(409, 'These dates overlap an existing booking.');
    const overlap = await BookingClosure.findOne({ where: { room_id: roomId, starts_on: { [Op.lt]: dates.checkOut }, ends_on: { [Op.gt]: dates.checkIn } }, transaction, lock: transaction.LOCK.UPDATE });
    if (overlap) fail(409, 'These dates overlap an existing closure.');
    const closure = await BookingClosure.create({ room_id: roomId, starts_on: dates.checkIn, ends_on: dates.checkOut, reason }, { transaction });
    await recordAudit(actor, 'CLOSURE_CREATED', 'CLOSURE', closure.closure_id, `Room ${room.room_number}`, { room_id: roomId, start: dates.checkIn, end: dates.checkOut, reason }, transaction); return closure;
  });
}
export async function releaseBookingDates(id, actor) {
  return sequelize.transaction(async transaction => {
    const snapshot = await BookingClosure.findByPk(positiveId(id), { transaction, paranoid: false }); if (!snapshot) fail(404, 'Closure not found.');
    await BookingRoom.findByPk(snapshot.room_id, { transaction, lock: transaction.LOCK.UPDATE });
    const closure = await BookingClosure.findByPk(snapshot.closure_id, { transaction, paranoid: false, lock: transaction.LOCK.UPDATE });
    if (closure.deletedAt) return;
    await closure.destroy({ transaction }); await recordAudit(actor, 'CLOSURE_RELEASED', 'CLOSURE', closure.closure_id, `Room ID ${closure.room_id}`, { start: closure.starts_on, end: closure.ends_on }, transaction);
  });
}
