import { languages, currencies, translate, templates } from './translations.js';
const root = document.documentElement, lang = root.lang, index = Math.max(0, languages.findIndex(item => item.code === lang));
const currency = root.dataset.currency || 'PHP', locale = root.dataset.locale || 'en-PH', rate = Number(root.dataset.rate || 1);
StayBook.locale = locale;
StayBook.t = text => translate(text, lang);
StayBook.count = (key, n) => {
  if (index === 0 && key === 'guests') return `${n} ${Number(n) === 1 ? 'guest' : 'guests'}`;
  if (index === 0 && key === 'nights') return `${n} ${Number(n) === 1 ? 'night' : 'nights'}`;
  return templates[key][index].replace('{n}', n);
};
StayBook.money = value => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value) * rate);
function sentence(text) {
  const direct = StayBook.t(text); if (direct !== text || lang === 'en') return direct;
  const patterns = [[/^Up to (\d+) guests$/, 'capacity'], [/^(\d+) guests?$/, 'guests'], [/^(\d+) nights?$/, 'nights'], [/^(\d+) rooms? available$/, 'available'], [/^(\d+) room types? available$/, 'types'], [/^Room ([\d /]+)$/, 'room'], [/^Welcome, (.+)\. Your next stay starts here\.$/, 'welcome'], [/^Save booking · (.+)$/, 'save']];
  for (const [pattern, key] of patterns) { const match = text.match(pattern); if (match) return templates[key][index].replace('{n}', match[1]); }
  const stayPrice = text.match(/^(.+) for (\d+) nights?$/);
  if (stayPrice) return `${stayPrice[1]} / ${StayBook.count('nights', stayPrice[2])}`;
  const choice = text.match(/^(\d+) rooms? to choose from$/);
  if (choice) return templates.available[index].replace('{n}', choice[1]);
  const properties = text.match(/^(\d+) propert(?:y|ies)$/);
  if (properties) return [text, `${properties[1]} hotel`, `${properties[1]} 家酒店`, `${properties[1]}施設`, `숙소 ${properties[1]}개`, `${properties[1]} alojamiento(s)`, `${properties[1]} établissement(s)`, `${properties[1]} Unterkünfte`, `${properties[1]} منشآت`][index];
  if (text.includes(' · ') || text.includes(' × ')) return text.split(/( · | × )/).map(part => part === ' · ' || part === ' × ' ? part : sentence(part)).join('');
  return text;
}
function localize(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.parentElement || node.parentElement.closest('script,style,textarea,[data-no-translate],.review-row dd')) return;
    const text = node.textContent.trim(); if (!text) return;
    const result = sentence(text); if (text !== result) node.textContent = node.textContent.replace(text, result);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;
  if (node.matches?.('[data-money]')) { node.textContent = StayBook.money(node.dataset.money); return; }
  for (const attribute of ['placeholder', 'aria-label']) if (node.hasAttribute?.(attribute)) { const old = node.getAttribute(attribute), value = sentence(old); if (old !== value) node.setAttribute(attribute, value); }
  for (const child of [...node.childNodes]) localize(child);
}
if (document.getElementById('languageSelect')) document.getElementById('languageSelect').innerHTML = languages.map(l => `<option value="${l.code}" ${l.code === lang ? 'selected' : ''}>${l.name}</option>`).join('');
if (document.getElementById('currencySelect')) document.getElementById('currencySelect').innerHTML = currencies.map(code => `<option value="${code}" ${code === currency ? 'selected' : ''}>${code} — ${new Intl.DisplayNames([locale], { type: 'currency' }).of(code)}</option>`).join('');
for (const [id, field] of [['languageSelect', 'language'], ['currencySelect', 'currency']]) document.getElementById(id)?.addEventListener('change', async event => {
  const control = event.target, error = document.getElementById('preferenceError'); control.disabled = true; error.textContent = '';
  try {
    // A preference change must not discard unsaved guest/account form fields.
    const form = document.getElementById('guestForm') || document.getElementById('authForm') || document.getElementById('lookup');
    if (form) sessionStorage.setItem(`staybook-form:${location.pathname}`, JSON.stringify([...new FormData(form)].filter(([name]) => name !== 'password')));
    await StayBook.request('/api/preferences', { method: 'POST', body: { [field]: control.value } }); location.reload();
  } catch (problem) { error.textContent = StayBook.t(problem.message); control.value = field === 'language' ? lang : currency; control.disabled = false; }
});
const form = document.getElementById('guestForm') || document.getElementById('authForm') || document.getElementById('lookup');
const saved = sessionStorage.getItem(`staybook-form:${location.pathname}`);
if (form && saved) { try { for (const [name, value] of JSON.parse(saved)) if (form.elements[name] && name !== 'password') form.elements[name].value = value; } catch {} sessionStorage.removeItem(`staybook-form:${location.pathname}`); }
localize(document.body);
new MutationObserver(records => { for (const record of records) { if (record.type === 'characterData') localize(record.target); else record.addedNodes.forEach(localize); } }).observe(document.body, { subtree: true, childList: true, characterData: true });
