document.getElementById('togglePassword').addEventListener('click', event => {
  const input = document.getElementById('password'), visible = input.type === 'password';
  input.type = visible ? 'text' : 'password'; event.target.textContent = visible ? 'Hide password' : 'Show password'; event.target.setAttribute('aria-pressed', String(visible));
});
document.getElementById('authForm').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, button = form.querySelector('button.btn'), original = button.innerHTML, error = document.getElementById('authError');
  error.textContent = ''; button.disabled = true; button.textContent = 'Please wait…';
  try { const data = await StayBook.request(`/api/auth/${form.dataset.mode}`, { method: 'POST', body: Object.fromEntries(new FormData(form)) }); location.href = data.redirect; }
  catch (problem) { error.textContent = problem.message; error.focus(); button.disabled = false; button.innerHTML = original; }
});
