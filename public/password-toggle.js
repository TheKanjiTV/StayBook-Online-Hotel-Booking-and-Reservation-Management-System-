document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    const setVisible = visible => {
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible)); button.setAttribute('aria-label', StayBook.t(visible ? 'Hide password' : 'Show password'));
      button.querySelector('.password-eye').hidden = visible; button.querySelector('.password-eye-off').hidden = !visible;
    };
    button.addEventListener('click', () => setVisible(input.type === 'password'));
    window.addEventListener('pagehide', () => setVisible(false));
  });
});
