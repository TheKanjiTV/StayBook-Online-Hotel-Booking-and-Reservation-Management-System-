import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const env = new URL('../.env', import.meta.url);
if (!existsSync(env)) writeFileSync(env, `PORT=3000\nHOST=127.0.0.1\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_USER=root\nDB_PASSWORD=\nDB_NAME=online_booking\nSESSION_SECRET=${randomBytes(32).toString('hex')}\n`);
const { migrate } = await import('../migrate.js');
const { sequelize } = await import('../models/db.js');
try { await migrate(); } catch (error) { console.error(error.message); process.exitCode = 1; } finally { await sequelize.close(); }
