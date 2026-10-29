import { Sequelize, DataTypes } from 'sequelize';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { sequelize } from './models/db.js';
import { BookingRoom, Reservation } from './models/bookingModel.js';
import { Account } from './models/accountModel.js';
import './models/auditModel.js';
import './models/availabilityModel.js';
import { sampleRooms } from './services/pmsApi.js';
export async function migrate() {
  const root = new Sequelize('mysql', config.dbUser, config.dbPassword, { host: config.dbHost, port: config.dbPort, dialect: 'mysql', logging: false });
  try {
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await sequelize.sync(); // Add missing booking tables only. Never drop existing tables.
    const query = sequelize.getQueryInterface(), table = Account.getTableName();
    const columns = await query.describeTable(table);
    if (!columns.username) await query.addColumn(table, 'username', { type: DataTypes.STRING(100), allowNull: true, unique: true });
    if (!columns.role) await query.addColumn(table, 'role', { type: DataTypes.ENUM('GUEST', 'ADMIN'), allowNull: false, defaultValue: 'GUEST' });
    if (!columns.deleted_at) await query.addColumn(table, 'deleted_at', { type: DataTypes.DATE, allowNull: true });
    if (!columns.version) await query.addColumn(table, 'version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    if (!columns.session_version) await query.addColumn(table, 'session_version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    const bookingColumns = await query.describeTable(Reservation.getTableName());
    if (!bookingColumns.deleted_at) await query.addColumn(Reservation.getTableName(), 'deleted_at', { type: DataTypes.DATE, allowNull: true });
    if (!bookingColumns.version) await query.addColumn(Reservation.getTableName(), 'version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    const roomColumns = await query.describeTable(BookingRoom.getTableName());
    if (!roomColumns.version) await query.addColumn(BookingRoom.getTableName(), 'version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    if (!roomColumns.is_published) await query.addColumn(BookingRoom.getTableName(), 'is_published', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    for (const room of sampleRooms) {
      await BookingRoom.findOrCreate({ where: { room_id: room.id }, defaults: {
        name: room.name, room_number: room.roomNumber, type: room.type, description: room.description, capacity: room.capacity, price: room.price, image: room.image,
      } });
    }
    console.log(`Online booking database ready: ${config.dbName}. No other system databases are accessed.`);
  } finally { await root.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await migrate(); } catch (error) { console.error('Migration failed:', error.message); process.exitCode = 1; } finally { await sequelize.close(); }
}
