(() => {
  const list = document.getElementById('notificationList'), badge = document.getElementById('notificationBadge'), error = document.getElementById('notificationError');
  const mark = document.getElementById('readNotifications'), retry = document.getElementById('retryNotifications');
  const { request, escape: esc } = StayBook;
  async function refresh() {
    try {
      const data = await request('/api/account/notifications'); error.textContent = ''; retry.hidden = true;
      badge.hidden = !data.unread; badge.textContent = data.unread > 99 ? '99+' : data.unread;
      document.querySelector('.notification-menu > summary').setAttribute('aria-label', `${StayBook.t('Notifications')} — ${data.unread} ${StayBook.t('Unread')}`);
      mark.hidden = !data.unread;
      list.innerHTML = data.notifications.length ? data.notifications.map(n => `<button class="notification-item ${n.read_at ? '' : 'unread'}" data-notification="${n.notification_id}" data-reservation="${n.reservation_id}"><strong>${n.kind === 'BOOKING_CANCELLED' ? 'Booking cancelled' : 'Booking saved'}</strong><span data-no-translate>${esc(n.reference)}</span><time datetime="${esc(n.created_at)}">${esc(StayBook.date(n.created_at))}</time>${n.read_at ? '' : '<span class="notification-new">Unread</span>'}</button>`).join('') : '<p class="muted py-5">You’re all caught up. Updates about your account bookings will appear here.</p>';
    } catch (problem) { error.textContent = problem.message; list.textContent = ''; retry.hidden = false; }
  }
  mark.onclick = async () => { mark.disabled = true; try { await request('/api/account/notifications/read', { method: 'POST', body: {} }); await refresh(); } catch (problem) { error.textContent = problem.message; } finally { mark.disabled = false; } };
  retry.onclick = refresh;
  list.onclick = async event => {
    const button = event.target.closest('[data-notification]'); if (!button) return; button.disabled = true;
    try {
      await request('/api/account/notifications/read', { method: 'POST', body: { notificationId: button.dataset.notification } });
      const result = await request('/api/account/bookings/open', { method: 'POST', body: { reservationId: button.dataset.reservation } }); location.href = result.redirect;
    } catch (problem) { error.textContent = problem.message; button.disabled = false; }
  };
  document.querySelector('.notification-menu').addEventListener('toggle', event => { if (event.target.open) refresh(); });
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
  refresh();
})();
