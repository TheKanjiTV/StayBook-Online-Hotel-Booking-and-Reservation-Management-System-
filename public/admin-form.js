document.querySelectorAll('[data-admin-form]').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault(); const button = form.querySelector('button[type=submit]'), error = form.querySelector('[role=alert]'), original = button.textContent;
  button.disabled = true; button.textContent = StayBook.t('Please wait…'); error.textContent = '';
  try { const data = await StayBook.request(form.dataset.endpoint, { method: 'POST', body: Object.fromEntries(new FormData(form)) }); location.href = data.redirect; }
  catch (problem) { error.textContent = problem.message; error.focus(); button.disabled = false; button.textContent = original; }
}));
