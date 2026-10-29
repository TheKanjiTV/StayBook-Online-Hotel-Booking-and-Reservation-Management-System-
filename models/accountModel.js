import { DataTypes as D } from 'sequelize';
import { sequelize } from './db.js';
import { Reservation } from './bookingModel.js';
const options = { timestamps: true, underscored: true };
export const Account = sequelize.define('GuestAccount', {
  account_id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
  first_name: { type: D.STRING(100), allowNull: false }, last_name: { type: D.STRING(100), allowNull: false },
  email: { type: D.STRING(255), allowNull: false, unique: true }, password_hash: { type: D.STRING(200), allowNull: false },
}, options);
// Ownership is explicit. Matching an unverified email never claims old bookings.
export const AccountBooking = sequelize.define('AccountBooking', {
  reservation_id: { type: D.INTEGER, primaryKey: true, references: { model: Reservation, key: 'reservation_id' } },
  account_id: { type: D.INTEGER, allowNull: false, references: { model: Account, key: 'account_id' } },
}, options);
export const Notification = sequelize.define('GuestNotification', {
  notification_id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
  account_id: { type: D.INTEGER, allowNull: false, references: { model: Account, key: 'account_id' } },
  reservation_id: { type: D.INTEGER, allowNull: false, references: { model: Reservation, key: 'reservation_id' } },
  reference: { type: D.STRING(30), allowNull: false }, kind: { type: D.STRING(30), allowNull: false }, read_at: { type: D.DATE },
}, { ...options, indexes: [{ unique: true, fields: ['reservation_id', 'kind'] }, { fields: ['account_id', 'read_at'] }] });
