(() => {
  const dialog = document.getElementById('adminActionDialog'), confirm = document.getElementById('adminActionConfirm'), error = document.getElementById('adminActionError');
  let current, busy = false;
  document.querySelectorAll('[data-admin-action]').forEach(button => button.addEventListener('click', () => {
    current = button; error.textContent = '';
    document.getElementById('adminActionTitle').textContent = StayBook.t(button.dataset.title);
    document.getElementById('adminActionDescription').textContent = StayBook.t(button.dataset.description);
    document.getElementById('adminActionReference').textContent = button.dataset.reference || '';
    confirm.textContent = StayBook.t(button.dataset.label); confirm.classList.toggle('btn-danger', button.dataset.danger === 'true'); dialog.showModal();
  }));
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  confirm.addEventListener('click', async () => {
    if (busy || !current) return; busy = true; error.textContent = ''; dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { const data = await StayBook.request(current.dataset.url, { method: 'POST', body: {} }); location.href = data.redirect; }
    catch (problem) { error.textContent = problem.message; error.focus(); busy = false; dialog.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  });
})();
