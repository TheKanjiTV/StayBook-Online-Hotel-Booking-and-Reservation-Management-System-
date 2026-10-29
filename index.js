/*
MIT License
Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
Mindoro State University - Philippines
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import hbs from 'hbs';
import 'dotenv/config';
import { sessionMiddleware, csrf } from './middleware/session.js';
import router from './routes/index.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin'); res.set('X-Frame-Options', 'DENY'); next(); });
app.use(express.static(path.join(root, 'public')));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(sessionMiddleware);
app.use(csrf);
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Retain XianFire's .xian view engine and Handlebars partial convention.
app.engine('xian', hbs.__express);
app.set('view engine', 'xian'); app.set('views', path.join(root, 'views'));
for (const file of fs.readdirSync(path.join(root, 'views/partials')).filter(f => f.endsWith('.xian'))) {
  hbs.registerPartial(path.basename(file, '.xian'), fs.readFileSync(path.join(root, 'views/partials', file), 'utf8'));
}
app.use(router);
app.use((req, res) => { res.status(404); if (req.path.startsWith('/api/')) return res.json({ success: false, message: 'Endpoint not found.' }); res.render('error', { title: 'Page not found', message: 'This page does not exist.' }); });
app.use((error, req, res, next) => {
  const status = error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : error.name === 'SequelizeValidationError' ? 400 : 500);
  const message = error.status ? error.message : status === 409 ? 'This record already exists.' : status === 400 ? 'Check the values and try again.' : 'Unable to complete this request. Please try again.';
  if (status >= 500) console.error(error.message);
  res.status(status);
  if (req.path.startsWith('/api/') || req.path === '/booking/preview' || req.path === '/rooms/search') return res.json({ success: false, message });
  res.render('error', { title: 'Request could not be completed', message });
});
export default app;
export async function startServer(port = Number(process.env.PORT || 3000)) {
  const server = createServer(app);
  const host = process.env.HOST || '127.0.0.1';
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  console.log(`StayBook · XianFire · http://${host}:${server.address().port}`);
  return server;
}
const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) startServer().catch(error => { console.error(error.message); process.exitCode = 1; });
