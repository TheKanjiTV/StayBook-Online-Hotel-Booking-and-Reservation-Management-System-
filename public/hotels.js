const hotelForm = document.getElementById('hotelSearch'), hotelRows = [...document.querySelectorAll('[data-hotel]')];
function filterHotels() {
  const query = document.getElementById('hotelQuery').value.trim().toLocaleLowerCase(), kind = document.getElementById('hotelKind').value;
  let count = 0;
  for (const row of hotelRows) {
    const visibleName = `${row.querySelector('h2').textContent} ${row.querySelector('.listing-features').textContent}`.toLocaleLowerCase();
    row.hidden = !((row.dataset.hotel.toLocaleLowerCase().includes(query) || visibleName.includes(query)) && (kind === 'all' || kind === row.dataset.kind));
    if (!row.hidden) count++;
  }
  document.getElementById('hotelCount').textContent = `${count} ${count === 1 ? 'property' : 'properties'}`;
  document.getElementById('hotelEmpty').hidden = count > 0;
}
hotelForm.addEventListener('submit', event => { event.preventDefault(); filterHotels(); });
document.getElementById('hotelQuery').addEventListener('input', filterHotels);
document.getElementById('hotelKind').addEventListener('change', filterHotels);
document.getElementById('resetHotels').onclick = () => { hotelForm.reset(); filterHotels(); document.getElementById('hotelQuery').focus(); };
filterHotels();
