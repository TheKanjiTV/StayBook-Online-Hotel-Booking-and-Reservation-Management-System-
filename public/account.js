(async () => {
  const { request, escape: esc, money } = StayBook, list = document.getElementById('accountBookings'), error = document.getElementById('accountError');
  document.getElementById('signOut').onclick = async event => { event.target.disabled = true; try { const data = await request('/api/auth/sign-out', { method: 'POST', body: {} }); location.href = data.redirect; } catch (problem) { error.textContent = problem.message; event.target.disabled = false; } };
  try {
    const { bookings } = await request('/api/account/bookings');
    list.innerHTML = bookings.length ? bookings.map(b => `<article class="account-booking"><div><h3>${esc(b.room_type)}</h3><p class="muted mt-2">${esc(b.reference)} · ${esc(b.check_in)} – ${esc(b.check_out)}</p><p class="muted">${b.status === 'CANCELLED' ? 'Cancelled' : 'Saved locally'} · ${money(b.total_amount)}</p></div><button class="btn-secondary" data-open="${b.reservation_id}">View booking</button></article>`).join('') : '<div class="empty-state"><h3>Your next stay is waiting.</h3><p>No account bookings yet. Choose your dates to get started.</p><a class="btn" href="/#booking">Find a room</a></div>';
    list.addEventListener('click', async event => { const button = event.target.closest('[data-open]'); if (!button) return; button.disabled = true; try { const data = await request('/api/account/bookings/open', { method: 'POST', body: { reservationId: button.dataset.open } }); location.href = data.redirect; } catch (problem) { error.textContent = problem.message; button.disabled = false; } });
  } catch (problem) { list.textContent = ''; error.textContent = problem.message; }
})();
