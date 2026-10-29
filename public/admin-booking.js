(() => {
  const open = document.getElementById('adminCancel'), dialog = document.getElementById('adminCancelDialog');
  const confirm = document.getElementById('adminConfirmCancel'), error = document.getElementById('adminCancelError');
  let busy = false;
  open?.addEventListener('click', () => { error.textContent = ''; dialog.showModal(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  confirm.addEventListener('click', async () => {
    if (busy || !open) return;
    busy = true; error.textContent = ''; dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { const result = await StayBook.request(`/api/admin/bookings/${open.dataset.reservation}/cancel`, { method: 'POST', body: {} }); location.href = result.redirect; }
    catch (problem) { error.textContent = problem.message; error.focus(); busy = false; dialog.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  });
})();
