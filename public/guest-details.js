(() => {
  const form = document.getElementById('guestForm'), button = document.getElementById('submitButton'), error = document.getElementById('errorMessage');
  const original = button.innerHTML, params = new URLSearchParams(location.search);
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent = ''; button.disabled = true; form.setAttribute('aria-busy', 'true'); button.textContent = 'Preparing your booking…';
    try {
      const body = { ...Object.fromEntries(new FormData(form)), roomId: params.get('roomId'), checkIn: params.get('checkIn'), checkOut: params.get('checkOut'), guests: params.get('guests') };
      const result = await StayBook.request('/booking/preview', { method: 'POST', body }); location.href = result.redirect;
    } catch (problem) { error.textContent = problem.message; error.focus(); }
    finally { button.disabled = false; button.innerHTML = original; form.setAttribute('aria-busy', 'false'); }
  });
})();
