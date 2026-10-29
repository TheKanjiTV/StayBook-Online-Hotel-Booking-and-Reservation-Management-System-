document.querySelectorAll('[data-room-search]').forEach(form => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const params = new URLSearchParams(location.search);
  const ci = form.elements.checkIn, co = form.elements.checkOut, guests = form.elements.guests;
  const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const nextDay = date => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
  ci.min = today; ci.value = isDate(params.get('checkIn')) && params.get('checkIn') >= today ? params.get('checkIn') : today;
  co.min = nextDay(ci.value); co.value = isDate(params.get('checkOut')) && params.get('checkOut') > ci.value ? params.get('checkOut') : co.min;
  const count = Number(params.get('guests')); if (Number.isInteger(count) && count >= 1 && count <= 10) guests.value = String(count);
  ci.addEventListener('change', () => { if (!isDate(ci.value)) return; co.min = nextDay(ci.value); if (co.value <= ci.value) co.value = co.min; });
  form.addEventListener('submit', event => {
    const error = form.parentElement.querySelector('[data-search-error]'); if (error) error.textContent = '';
    if (!isDate(ci.value) || !isDate(co.value) || ci.value < today || co.value <= ci.value) { event.preventDefault(); if (error) error.textContent = 'Choose a check-out date after your check-in date.'; }
  });
});
