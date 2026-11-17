function setupNewBooking(container) {
  const form = container.querySelector('#adminNewBooking');
  if (!form) return;
  const room = form.elements.roomId, button = form.querySelector('button[type=submit]'), status = form.querySelector('#availabilityMessage');
  let rooms = [], controller;
  const php = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  function quote() {
    const selected = rooms.find(item => String(item.id) === room.value);
    form.querySelector('#quotedRate').textContent = selected ? php(selected.price) : '—';
    const fee = form.querySelector('#quotedExtraGuest');
    fee.hidden = !selected?.extraGuestNightly;
    fee.querySelector('dd').textContent = selected ? php(selected.extraGuestNightly) : '';
    form.querySelector('#quotedTotal').textContent = selected ? php(selected.stayTotal) : '—'; button.disabled = !selected;
  }
  async function available() {
    controller?.abort(); const active = controller = new AbortController(), previous = room.value; button.disabled = true; room.disabled = true; status.textContent = StayBook.t('Checking availability…');
    try {
      const query = new URLSearchParams({ checkIn: form.checkIn.value, checkOut: form.checkOut.value, guests: form.guests.value, hotelId: form.querySelector('#hotelId').value });
      const data = await StayBook.request(`/rooms/search?${query}`, { signal: active.signal }); if (active !== controller || !form.isConnected) return;
      rooms = data.rooms; room.replaceChildren(new Option(StayBook.t('Select a room'), ''));
      rooms.forEach(item => room.add(new Option(`${item.hotel.name} · ${item.roomNumber} · ${item.type} · ${php(item.price)}`, item.id)));
      if (rooms.some(item => String(item.id) === previous)) room.value = previous;
      status.textContent = rooms.length ? StayBook.count('available', rooms.length) : StayBook.t('No rooms available for these dates.'); quote();
    } catch (error) { if (error.name !== 'AbortError' && active === controller) { rooms = []; room.replaceChildren(new Option(StayBook.t('Select a room'), '')); status.textContent = error.message; quote(); } }
    finally { if (active === controller) room.disabled = false; }
  }
  ['checkIn', 'checkOut', 'hotelId'].forEach(id => form.querySelector('#' + id).addEventListener('change', available));
  form.elements.guests.addEventListener('input', available);
  room.addEventListener('change', quote);
  form.querySelector('#accountId').addEventListener('change', event => {
    const option = event.target.selectedOptions[0], linked = Boolean(event.target.value); form.email.readOnly = linked;
    if (linked) { form.firstName.value = option.dataset.first; form.lastName.value = option.dataset.last; form.email.value = option.dataset.email; }
  });
  form.email.readOnly = Boolean(form.querySelector('#accountId').value);
  available();
}
document.addEventListener('DOMContentLoaded', () => setupNewBooking(document));
document.addEventListener('staybook:booking-panel', event => setupNewBooking(event.detail));
