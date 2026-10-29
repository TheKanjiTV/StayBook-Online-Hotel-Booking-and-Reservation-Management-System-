import { Sequelize } from 'sequelize';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { sequelize } from './models/db.js';
import { BookingRoom } from './models/bookingModel.js';
import './models/accountModel.js';
import { sampleRooms } from './services/pmsApi.js';
export async function migrate() {
  const root = new Sequelize('mysql', config.dbUser, config.dbPassword, { host: config.dbHost, port: config.dbPort, dialect: 'mysql', logging: false });
  try {
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await sequelize.sync(); // Add missing booking tables only. Never drop existing tables.
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
