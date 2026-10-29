import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { Session } from '../models/bookingModel.js';
class BookingSessionStore extends session.Store {
  get(sid, cb) { Session.findByPk(sid).then(row => cb(null, row && row.expires > new Date() ? JSON.parse(row.data) : null)).catch(cb); }
  set(sid, data, cb) { Session.upsert({ sid, data: JSON.stringify(data), expires: new Date(data.cookie.expires || Date.now() + 86400000) }).then(() => cb?.()).catch(cb); }
  destroy(sid, cb) { Session.destroy({ where: { sid } }).then(() => cb?.()).catch(cb); }
  touch(sid, data, cb) { Session.update({ expires: new Date(data.cookie.expires || Date.now() + 86400000) }, { where: { sid } }).then(() => cb?.()).catch(cb); }
}
export const sessionMiddleware = session({
  name: 'staybook.sid', secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  store: new BookingSessionStore(), resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 },
});
export function csrf(req, res, next) {
  req.session.csrf ||= randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.get('x-csrf-token') || req.body?._csrf) !== req.session.csrf) return res.status(403).json({ success: false, message: 'Reload the page and try again.' });
  next();
}
