window.StayBook = {
  locale: document.documentElement.dataset.locale || 'en-PH',
  t: text => text,
  configureSummaries() { const mobile = matchMedia('(max-width: 760px)').matches; document.querySelectorAll('.summary-disclosure').forEach(details => { details.open = !mobile; }); },
  icon(name) {
    const paths = { arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>', guests: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 4v2"/>', bed: '<path d="M3 18V7m18 11V7M3 11h18M3 17h18M7 11V7h10v4M3 21v-3m18 3v-3"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', check: '<path d="m5 12 4 4L19 6"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>' };
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
  },
  async request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content, ...options.headers },
      ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(StayBook.t(data.message || 'Request failed. Please try again.'));
    return data;
  },
  money(value) { const root = document.documentElement; return new Intl.NumberFormat(root.dataset.locale || 'en-PH', { style: 'currency', currency: root.dataset.currency || 'PHP' }).format(Number(value) * Number(root.dataset.rate || 1)); },
  escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  date(value) { return value ? new Date(value).toLocaleString(StayBook.locale, { timeZone: 'Asia/Manila' }) : '—'; },
};
document.addEventListener('DOMContentLoaded', () => {
  StayBook.configureSummaries();
  const current = ['/rooms', '/guest-details', '/confirmation'].includes(location.pathname) ? '/rooms' : location.pathname;
  document.querySelectorAll('.site-header nav a').forEach(link => { if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'page'); });
});
matchMedia('(max-width: 760px)').addEventListener('change', () => StayBook.configureSummaries());
