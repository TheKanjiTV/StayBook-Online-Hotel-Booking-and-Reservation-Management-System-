import { DataTypes as D } from 'sequelize';
import { sequelize } from './db.js';
const text = (n = 100) => ({ type: D.STRING(n), allowNull: false });
const money = () => ({ type: D.DECIMAL(12, 2), allowNull: false });
const id = () => ({ type: D.INTEGER, primaryKey: true, autoIncrement: true });
const options = { timestamps: true, underscored: true };
export const activeBookingStatuses = ['LOCAL_CONFIRMED', 'ADMIN_CONFIRMED'];
// Read-only sample catalog used by this booking application until PMS integration.
// This is not the hotel's operational room inventory or room-status management.
export const BookingRoom = sequelize.define('BookingRoom', {
  room_id: { type: D.INTEGER, primaryKey: true }, name: text(), room_number: text(20), type: text(),
  description: text(500), capacity: { type: D.INTEGER, allowNull: false }, price: money(), image: text(500),
}, options);
export const Reservation = sequelize.define('Reservation', {
  reservation_id: id(), reference: { ...text(30), unique: true }, request_key: { ...text(), unique: true }, request_hash: text(), access_token: text(),
  room_id: { type: D.INTEGER, allowNull: false }, room_name: text(), room_number: text(20), room_type: text(),
  first_name: text(), last_name: text(), email: text(255), phone: text(20), address: { type: D.TEXT },
  check_in: { type: D.DATEONLY, allowNull: false }, check_out: { type: D.DATEONLY, allowNull: false },
  guests: { type: D.INTEGER, allowNull: false }, nights: { type: D.INTEGER, allowNull: false },
  nightly_rate: money(), total_amount: money(), status: text(30),
}, { ...options, paranoid: true, version: true, indexes: [{ fields: ['room_id', 'status', 'check_in', 'check_out'] }] });
export const Payment = sequelize.define('Payment', {
  payment_id: id(), reservation_id: { type: D.INTEGER, allowNull: false }, amount: money(),
  payment_method: text(30), payment_status: text(30), paid_at: { type: D.DATE }, reference: { ...text(), unique: true }, purpose: text(30),
}, options);
Payment.belongsTo(Reservation, { foreignKey: 'reservation_id' });
export const Session = sequelize.define('Session', {
  sid: { ...text(128), primaryKey: true }, data: { type: D.TEXT('medium'), allowNull: false }, expires: { type: D.DATE, allowNull: false },
}, options);
