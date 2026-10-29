import session from 'express-session';
import { randomBytes } from 'node:crypto';
export const sessionMiddleware = session({
  name: 'staybook.sid', secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 },
});
export function csrf(req, res, next) {
  req.session.csrf ||= randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.get('x-csrf-token') || req.body?._csrf) !== req.session.csrf) return res.status(403).json({ success: false, message: 'Reload the page and try again.' });
  next();
}
