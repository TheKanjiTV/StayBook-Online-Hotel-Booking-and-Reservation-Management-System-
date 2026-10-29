import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';
import { BookingRoom, Reservation, activeBookingStatuses } from '../models/bookingModel.js';
import { positiveId, string, cents, amount, today, fail } from './validation.js';
import { checkVersion } from './adminBookingService.js';
import { recordAudit } from './auditService.js';
export async function updateCatalogRoom(id, body, actor) {
  const capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10) fail(400, 'Room capacity must be between 1 and 10.');
  if (![true, false, '1', '0'].includes(body.published)) fail(400, 'Choose a valid publication status.');
  const type = string(body.type, 'Room type'), values = { type, description: string(body.description, 'Description', 500), capacity, price: amount(cents(body.price, 'Nightly rate')), is_published: body.published === true || body.published === '1' };
  return sequelize.transaction(async transaction => {
    const room = await BookingRoom.findByPk(positiveId(id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) fail(404, 'Room not found.'); checkVersion(room, body);
    const exceeds = await Reservation.findOne({ where: { room_id: room.room_id, status: { [Op.in]: activeBookingStatuses }, check_out: { [Op.gt]: today() }, guests: { [Op.gt]: capacity } }, transaction });
    if (exceeds) fail(409, 'Capacity cannot be lower than an upcoming booking guest count.');
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => String(room[key]) !== String(value)).map(([key, value]) => [key, { before: room[key], after: value }]));
    if (!Object.keys(changes).length) return;
    await room.update({ ...values, name: `${type} · ${room.room_number}` }, { transaction });
    await recordAudit(actor, 'ROOM_UPDATED', 'ROOM', room.room_id, room.room_number, changes, transaction);
  });
}
