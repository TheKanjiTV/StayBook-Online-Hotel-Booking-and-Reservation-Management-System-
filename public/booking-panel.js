(() => {
  const dialog = document.querySelector('[data-booking-dialog]');
  const content = dialog.querySelector('[data-booking-dialog-content]');
  const close = dialog.querySelector('[data-close-booking]');
  let request, currentUrl, opener, changed = false;

  async function open(url, trigger) {
    if (!dialog.open) {
      opener = trigger || document.activeElement;
      dialog.showModal();
    }
    currentUrl = url;
    request?.abort();
    const pending = request = new AbortController();
    dialog.setAttribute('aria-label', StayBook.t('Booking details'));
    content.setAttribute('aria-busy', 'true');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = StayBook.t('Opening booking…');
    content.replaceChildren(status);
    try {
      const response = await fetch(url, { signal: pending.signal, cache: 'no-store' });
      if (response.redirected) { location.assign(response.url); return; }
      if (!response.ok) throw new Error(StayBook.t('This booking could not be opened.'));
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const panel = page.querySelector('[data-booking-panel]');
      if (!panel) throw new Error(StayBook.t('This booking could not be opened.'));
      if (pending !== request || !dialog.open) return;
      content.replaceChildren(panel);
      const heading = panel.querySelector('h1');
      if (heading) {
        dialog.setAttribute('aria-label', StayBook.t(heading.textContent));
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      content.scrollTop = 0;
      document.dispatchEvent(new CustomEvent('staybook:booking-panel', { detail: panel }));
    } catch (error) {
      if (error.name === 'AbortError' || pending !== request || !dialog.open) return;
      status.textContent = error.message;
      status.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn-secondary mt-4';
      retry.textContent = StayBook.t('Try again');
      retry.onclick = () => open(url);
      content.append(retry);
      retry.focus();
    } finally {
      if (pending === request) content.removeAttribute('aria-busy');
    }
  }

  content.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-booking]');
    if (!button) return;
    const status = button.parentElement.querySelector('[data-copy-booking-status]');
    try {
      await navigator.clipboard.writeText(button.dataset.copyBooking);
      status.textContent = StayBook.t('Copied');
    } catch {
      status.textContent = StayBook.t('Select your booking reference and copy it manually.');
    }
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-booking-panel-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(link.href, link);
  });
  close.onclick = () => { if (!close.disabled) dialog.close(); };
  dialog.addEventListener('cancel', event => { if (close.disabled) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    request?.abort();
    content.replaceChildren();
    if (changed) location.reload();
    else if (!opener?.disabled) opener?.focus();
  });

  StayBook.bookingPanel = {
    open,
    setBusy(source, busy) { if (dialog.contains(source)) close.disabled = busy; },
    saved(source, redirect) {
      if (!dialog.contains(source)) return false;
      changed = true;
      if (source.hasAttribute('data-guest-booking-action')) open(currentUrl);
      else if (/^\/admin\/bookings\/\d+$/.test(redirect || '')) open(redirect);
      else dialog.close();
      return true;
    },
  };
})();
