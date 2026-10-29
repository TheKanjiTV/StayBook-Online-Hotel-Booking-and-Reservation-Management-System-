import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { languages, currencies } from '../public/translations.js';
import { fail } from './validation.js';
import { config } from '../config.js';
import { createHash } from 'node:crypto';
let cached, pending, retryAfter = 0;
const provider = config.exchangeRateApiKey ? 'standard' : 'open';
const source = config.exchangeRateApiKey ? `standard:${createHash('sha256').update(config.exchangeRateApiKey).digest('hex').slice(0, 12)}` : 'open';
const cacheFile = new URL('../.test-data/fx-cache.json', import.meta.url);
export async function exchangeRates() {
  if (cached && Date.now() < cached.next) return cached;
  if (Date.now() < retryAfter) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      if (!cached) { try { const saved = JSON.parse(await readFile(cacheFile, 'utf8')); if (saved.source === source) cached = saved; } catch {} }
      if (cached && Date.now() < cached.next) return cached;
      const endpoint = config.exchangeRateApiKey ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(config.exchangeRateApiKey)}/latest/PHP` : 'https://open.er-api.com/v6/latest/PHP';
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error('Rate provider unavailable');
      const data = await response.json();
      const rates = provider === 'standard' ? data.conversion_rates : data.rates;
      if (data.result !== 'success' || data.base_code !== 'PHP' || !currencies.every(code => Number.isFinite(rates?.[code]) && rates[code] > 0)) throw new Error('Invalid exchange rates');
      cached = { source, provider, rates, updated: data.time_last_update_utc, next: data.time_next_update_unix * 1000 };
      await mkdir(new URL('../.test-data/', import.meta.url), { recursive: true });
      await writeFile(cacheFile, JSON.stringify(cached));
    } catch { retryAfter = Date.now() + 300000; }
    return cached;
  })().finally(() => { pending = null; });
  return pending;
}
export async function preferencesContext(req, res, next) {
  try {
    const language = languages.find(item => item.code === req.session.language) || languages[0];
    const currency = currencies.includes(req.session.currency) ? req.session.currency : 'PHP';
    const fx = currency === 'PHP' ? cached : await exchangeRates();
    const rate = currency === 'PHP' ? 1 : fx?.rates[currency];
    res.locals.preferences = { language: language.code, languageName: language.name, locale: language.locale, currency: rate ? currency : 'PHP', rate: rate || 1,
      direction: language.code === 'ar' ? 'rtl' : 'ltr', updated: fx?.updated || '', unavailable: !rate };
    next();
  } catch (error) { next(error); }
}
export async function savePreferences(req, res) {
  if (req.body.language !== undefined) {
    const language = languages.find(item => item.code === req.body.language);
    if (!language) fail(400, 'Choose a supported language.');
    const fx = language.currency === 'PHP' ? null : await exchangeRates();
    if (language.currency !== 'PHP' && !fx?.rates[language.currency]) fail(503, 'Currency conversion is unavailable. Please try again later.');
    req.session.language = language.code; req.session.currency = language.currency;
  } else if (req.body.currency !== undefined) {
    if (!currencies.includes(req.body.currency)) fail(400, 'Choose a supported currency.');
    const fx = req.body.currency === 'PHP' ? null : await exchangeRates();
    if (req.body.currency !== 'PHP' && !fx?.rates[req.body.currency]) fail(503, 'Currency conversion is unavailable. Please try again later.');
    req.session.currency = req.body.currency;
  } else fail(400, 'Choose a language or currency.');
  res.json({ success: true });
}
