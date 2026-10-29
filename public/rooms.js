(() => {
  const { request, escape: esc, money, icon } = StayBook;
  const form = document.querySelector('[data-room-search]'), container = document.getElementById('roomContainer');
  const filterBox = document.getElementById('roomFilters'), sort = document.getElementById('sortOrder');
  const params = new URLSearchParams(location.search);
  let groups = [], selectedType = params.get('type') || 'all';
  const dates = () => ({ checkIn: form.elements.checkIn.value, checkOut: form.elements.checkOut.value, guests: form.elements.guests.value, hotelId: form.elements.hotelId?.value || '' });
  const shortDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(StayBook.locale, { day: 'numeric', month: 'short' });
  const nights = () => (Date.parse(dates().checkOut) - Date.parse(dates().checkIn)) / 86400000;
  sort.value = ['price-low', 'price-high', 'capacity'].includes(params.get('sort')) ? params.get('sort') : 'recommended';
  function renderFilters() {
    const types = [...new Set(groups.map(g => g.room.type))];
    if (!types.includes(selectedType)) selectedType = 'all';
    filterBox.innerHTML = ['all', ...types].map(type => `<button class="filter-button" type="button" aria-pressed="${type === selectedType}" data-type="${esc(type)}">${esc(type === 'all' ? 'All rooms' : type)}</button>`).join('');
  }
  function render() {
    let shown = groups.filter(g => selectedType === 'all' || g.room.type === selectedType);
    if (sort.value === 'price-low') shown.sort((a,b) => a.room.price - b.room.price);
    if (sort.value === 'price-high') shown.sort((a,b) => b.room.price - a.room.price);
    if (sort.value === 'capacity') shown.sort((a,b) => b.room.capacity - a.room.capacity);
    const count = shown.reduce((sum, g) => sum + g.rooms.length, 0), n = nights(), d = dates();
    document.getElementById('resultCount').textContent = `${shown.length} room ${shown.length === 1 ? 'type' : 'types'} available`;
    document.getElementById('searchSummary').textContent = `${shortDate(d.checkIn)} – ${shortDate(d.checkOut)} · ${n} ${n === 1 ? 'night' : 'nights'} · ${d.guests} ${Number(d.guests) === 1 ? 'guest' : 'guests'}${count ? ` · ${count} ${count === 1 ? 'room' : 'rooms'} to choose from` : ''}`;
    if (!shown.length) {
      container.innerHTML = `<div class="empty-state">${icon('search')}<h2>No rooms for these plans.</h2><p>Try different dates or a smaller guest count. Your next stay might be just a change away.</p><button id="changeDates" class="btn-secondary">Change your dates</button></div>`;
      document.getElementById('changeDates').onclick = () => { form.scrollIntoView({ block: 'center' }); form.elements.checkIn.focus(); };
      return;
    }
    container.innerHTML = shown.map(({ room: r, rooms }) => {
      const query = new URLSearchParams({ ...d, roomId: r.id });
      return `<article class="room-listing"><img class="listing-photo" src="${esc(r.image)}" alt="${esc(r.type)} interior, illustrative photograph" width="600" height="420" loading="lazy">
        <div class="listing-info"><div class="listing-top"><h2>${esc(r.type)}</h2><span class="availability-label">${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} available</span></div>
        <p class="muted mt-3">${esc(r.hotel?.name || '')}</p><p class="listing-description">${esc(r.description)}</p><div class="listing-features"><span>${icon('guests')} Up to ${esc(r.capacity)} guests</span><span>${icon('bed')} Room ${esc(rooms.map(room => room.roomNumber).join(' / '))}</span></div>
        <div class="listing-bottom"><div class="listing-price"><strong>${money(r.price)}</strong><span> / night</span><p>${money(r.price * n)} for ${n} ${n === 1 ? 'night' : 'nights'}</p></div><a class="btn" href="/guest-details?${esc(query.toString())}">Select room ${icon('arrow')}</a></div></div></article>`;
    }).join('');
  }
  async function loadRooms() {
    container.setAttribute('aria-busy', 'true');
    try {
      const { rooms } = await request(`/rooms/search?${new URLSearchParams(dates())}`);
      const map = new Map();
      rooms.forEach(room => { const key = `${room.hotel?.id}:${room.type}:${room.price}:${room.capacity}`; if (!map.has(key)) map.set(key, { room, rooms: [] }); map.get(key).rooms.push(room); });
      groups = [...map.values()]; renderFilters(); render();
    } catch (error) {
      document.getElementById('resultCount').textContent = 'Rooms could not be loaded'; filterBox.innerHTML = '';
      container.innerHTML = `<div class="empty-state">${icon('search')}<h2>Let’s try that again.</h2><p>${esc(error.message)}</p><button id="retryRooms" class="btn-secondary">Retry room search</button></div>`;
      document.getElementById('retryRooms').onclick = () => { container.innerHTML = '<p class="muted py-10" role="status">Checking availability…</p>'; loadRooms(); };
    } finally { container.setAttribute('aria-busy', 'false'); }
  }
  function updateUrl() { const query = new URLSearchParams(dates()); if (selectedType !== 'all') query.set('type', selectedType); if (sort.value !== 'recommended') query.set('sort', sort.value); history.replaceState(null, '', `/rooms?${query}`); }
  filterBox.addEventListener('click', e => { const button = e.target.closest('[data-type]'); if (!button) return; selectedType = button.dataset.type; renderFilters(); updateUrl(); render(); });
  sort.addEventListener('change', () => { updateUrl(); render(); });
  loadRooms();
})();
