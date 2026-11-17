document.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.matches('[data-admin-form]')) return;
  event.preventDefault();
  const button = event.submitter || form.querySelector('button[type=submit]');
  if (form.getAttribute('aria-busy') === 'true') return;
  const error = form.querySelector('[role=alert]');
  const body = Object.fromEntries(new FormData(form));
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  StayBook.bookingPanel.setBusy(form, true);
  error.textContent = '';
  try {
    const { redirect } = await StayBook.request(form.dataset.endpoint, { method: 'POST', body });
    StayBook.bookingPanel.setBusy(form, false);
    if (!StayBook.bookingPanel.saved(form, redirect)) location.assign(redirect);
  } catch (problem) {
    error.textContent = problem.message;
    error.focus();
  } finally {
    StayBook.bookingPanel.setBusy(form, false);
    form.removeAttribute('aria-busy');
    button.disabled = false;
  }
});
