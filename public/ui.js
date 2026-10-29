window.StayBook = {
  async request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content, ...options.headers },
      ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Request failed. Please try again.');
    return data;
  },
  money(value) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value)); },
  escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  date(value) { return value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'; },
};
