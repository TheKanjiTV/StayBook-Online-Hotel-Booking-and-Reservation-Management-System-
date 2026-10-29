import 'dotenv/config';
export const config = {
  dbName: process.env.DB_NAME || 'online_booking',
  dbHost: process.env.DB_HOST || '127.0.0.1', dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || 'root', dbPassword: process.env.DB_PASSWORD || '',
};
if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(config.dbName)) throw new Error('Invalid DB_NAME. Use letters, digits and underscores.');
