import { DataTypes as D } from 'sequelize';
import { sequelize } from './db.js';
export const BookingClosure = sequelize.define('BookingClosure', {
  closure_id: { type: D.INTEGER, primaryKey: true, autoIncrement: true }, room_id: { type: D.INTEGER, allowNull: false },
  starts_on: { type: D.DATEONLY, allowNull: false }, ends_on: { type: D.DATEONLY, allowNull: false }, reason: { type: D.STRING(200), allowNull: false },
}, { timestamps: true, underscored: true, paranoid: true, indexes: [{ fields: ['room_id', 'starts_on', 'ends_on'] }] });
