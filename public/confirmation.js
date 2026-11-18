import { paymentMethods, paymentLabel } from './payment-methods.js';
import { cardBrand, formatCardNumber, validCardNumber, formatExpiry, validExpiry, validSecurityCode } from './card.js';
(() => {
  const { request, money, escape: esc, icon } = StayBook;
  const content = document.getElementById('content'), message = document.getElementById('message');
  const cancelDialog = document.getElementById('cancelDialog'), cancelError = document.getElementById('cancelError'), confirmCancel = document.getElementById('confirmCancel');
  const refundPolicy = document.getElementById('refundPolicy').innerHTML;
  let cancelling = false;
  cancelDialog.addEventListener('cancel', event => { if (cancelling) event.preventDefault(); });
  confirmCancel.addEventListener('click', async () => {
    if (cancelling) return;
    cancelling = true; cancelError.textContent = '';
    cancelDialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      await request('/api/bookings/cancel', { method: 'POST', body: {} });
      cancelDialog.close(); message.textContent = ''; await load();
      const heading = content.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus(); }
    } catch (error) { cancelError.textContent = error.message; cancelError.focus(); }
    finally { cancelling = false; cancelDialog.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  });
  const row = (label, value) => `<div class="review-row"><dt>${esc(label)}</dt><dd ${label === 'Payment preference' ? '' : 'data-no-translate'}>${esc(value)}</dd></div>`;
  const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString(StayBook.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const methodChoices = () => `<section class="payment-sheet" aria-label="Payment details"><h3>Pay with</h3><div class="wallet-buttons">${paymentMethods.filter(method => method.kind === 'Digital wallet').map(method => `<button type="button" class="wallet-button" data-wallet="${method.id}" aria-pressed="false" aria-label="${method.label}"><img src="/payment-logos/${method.logo}" alt="${method.label}" width="100" height="28"></button>`).join('')}</div><div class="payment-divider"><span>OR</span></div><div id="cardFields" class="sheet-card-fields"><label class="sr-only" for="cardNumber">Card number</label><div class="sheet-input card-number-wrap"><input id="cardNumber" type="text" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="Card number" aria-describedby="cardHelp" required><div id="acceptedCardBrands" class="card-brand-strip" aria-label="Accepted cards">${['MASTERCARD', 'VISA', 'AMEX', 'DISCOVER'].map(id => { const method = paymentMethods.find(item => item.id === id); return `<img src="/payment-logos/${method.logo}" alt="${method.label}" width="38" height="26">`; }).join('')}</div><img id="cardBrandImage" src="/payment-logos/card.svg" alt="Card" width="64" height="42" hidden></div><div class="sheet-field-row"><div class="sheet-input"><label class="sr-only" for="cardExpiry">Expiration date</label><input id="cardExpiry" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="Expiration date" aria-describedby="cardHelp" required></div><div class="sheet-input cvc-wrap"><label class="sr-only" for="cardSecurity">Security code</label><input id="cardSecurity" type="password" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="Security code" aria-describedby="cardHelp" required><svg viewBox="0 0 32 26" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2" width="28" height="20" rx="3"/><path d="M2 7h28m-19 9h1m4 0h1m4 0h1"/></svg></div></div></div><label class="remember-method"><input id="rememberMethod" type="checkbox"><span>Remember my payment method on this device</span></label><p id="walletStatus" class="wallet-status" role="status"></p><p id="cardHelp" class="sheet-help">Use test card details. No payment will be made.</p><p id="cardBrandStatus" class="sr-only" role="status"></p></section>`;
  function configurePayment(form) {
    const number = document.getElementById('cardNumber'), expiry = document.getElementById('cardExpiry'), security = document.getElementById('cardSecurity');
    const image = document.getElementById('cardBrandImage'), accepted = document.getElementById('acceptedCardBrands'), status = document.getElementById('cardBrandStatus');
    const remember = document.getElementById('rememberMethod'), walletStatus = document.getElementById('walletStatus'), fields = [number, expiry, security];
    let selected = 'CARD';
    function resetCard() { fields.forEach(field => { field.value = ''; field.setCustomValidity(''); field.removeAttribute('aria-invalid'); }); image.hidden = true; accepted.hidden = false; status.textContent = ''; }
    function choose(method) {
      selected = method; fields.forEach(field => { field.required = method === 'CARD'; field.setCustomValidity(''); field.removeAttribute('aria-invalid'); });
      form.querySelectorAll('[data-wallet]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.wallet === method)); });
      walletStatus.textContent = method === 'CARD' ? '' : `${paymentLabel(method)} · ${StayBook.t('Selected')}`;
    }
    form.querySelectorAll('[data-wallet]').forEach(button => button.addEventListener('click', () => { resetCard(); choose(button.dataset.wallet); }));
    fields.forEach(field => field.addEventListener('input', () => { choose('CARD'); field.setCustomValidity(''); field.removeAttribute('aria-invalid'); }));
    number.addEventListener('input', () => {
      number.value = formatCardNumber(number.value);
      const method = paymentMethods.find(item => item.id === cardBrand(number.value));
      image.hidden = !method; accepted.hidden = Boolean(method);
      if (method) { image.src = `/payment-logos/${method.logo}`; image.alt = method.label; }
      status.textContent = method?.label || '';
      security.maxLength = method?.id === 'AMEX' ? 4 : 3; security.value = security.value.slice(0, security.maxLength);
    });
    expiry.addEventListener('input', () => { expiry.value = formatExpiry(expiry.value); });
    security.addEventListener('input', () => { security.value = security.value.replace(/\D/g, '').slice(0, security.maxLength); });
    window.addEventListener('pagehide', resetCard, { once: true });
    try { const saved = localStorage.getItem('staybook.paymentMethod'); if (paymentMethods.some(method => method.id === saved)) { remember.checked = true; if (['APPLE_PAY', 'GOOGLE_PAY'].includes(saved)) choose(saved); } } catch {}
    const invalid = (field, message) => { field.setCustomValidity(StayBook.t(message)); field.setAttribute('aria-invalid', 'true'); field.reportValidity(); field.focus(); return null; };
    const getMethod = () => {
      if (selected !== 'CARD') return { paymentMethod: selected };
      if (!validCardNumber(number.value)) return invalid(number, 'Enter a valid test card number.');
      if (!validExpiry(expiry.value)) return invalid(expiry, 'Enter a valid expiration date (MM/YY).');
      if (!validSecurityCode(security.value, cardBrand(number.value))) return invalid(security, 'Enter the correct security code for this test card.');
      return { paymentMethod: cardBrand(number.value), cardLast4: number.value.replace(/\D/g, '').slice(-4) };
    };
    getMethod.complete = method => { try { if (remember.checked) localStorage.setItem('staybook.paymentMethod', method); else localStorage.removeItem('staybook.paymentMethod'); } catch {} resetCard(); };
    return getMethod;
  }
  function summary({ image, hotelName, room, roomNumber, checkIn, checkOut, nights, guests, rate, extra, total }) {
    return `<aside class="stay-summary" aria-label="Your stay"><details class="summary-disclosure" open><summary class="summary-toggle"><span>Your stay</span><strong>${money(total)}</strong><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="summary-body">${image ? `<img src="${esc(image)}" alt="${esc(room)} interior, illustrative photograph" width="500" height="310">` : ''}<div class="summary-content"><h2>${esc(room)}</h2><p class="muted mt-2" data-no-translate>${esc(hotelName || '')}</p><p class="muted mt-2">Room ${esc(roomNumber)}</p><dl class="summary-dates"><div><dt>Check-in</dt><dd>${esc(dateLabel(checkIn))}</dd></div><div><dt>Check-out</dt><dd>${esc(dateLabel(checkOut))}</dd></div></dl><p class="muted summary-occupancy">${nights} ${nights === 1 ? 'night' : 'nights'} · ${guests} ${guests === 1 ? 'guest' : 'guests'}</p>${Number(extra) ? `<p class="field-help mt-3"><span>Includes extra guests</span> · ${money(extra)} / night</p>` : ''}<div class="summary-rate"><span>${money(rate)} × ${nights} ${nights === 1 ? 'night' : 'nights'}</span><span>${money(total)}</span></div><div class="summary-total"><span>Total for your stay</span><strong>${money(total)}</strong></div></div></div></details></aside>`;
  }
  function steps(saved, backQuery) {
    return `<ol class="booking-steps" aria-label="Booking progress"><li>${saved ? '<span>1</span> Choose your room' : `<a data-review-rooms href="/rooms?${esc(backQuery)}"><span>1</span> Choose your room</a>`}</li><li><span>2</span> Guest details</li><li aria-current="step"><span>3</span> ${saved ? 'Booking details' : 'Review booking'}</li></ol>`;
  }
  function reviewStay(booking) {
    const guests = Array.from({ length: booking.roomCapacity }, (_, index) => {
      const value = index + 1;
      return `<option value="${value}" ${value === booking.guests ? 'selected' : ''}>${value}</option>`;
    }).join('');
    return `<form id="reviewStay" class="review-stay" aria-labelledby="reviewStayTitle">
      <h2 id="reviewStayTitle" class="form-heading">Your stay</h2>
      <div class="review-stay-fields">
        <div class="search-field">
          <label for="reviewGuests">Guests</label>
          <select id="reviewGuests" name="guests" aria-describedby="reviewCapacity">${guests}</select>
        </div>
        <div class="search-field">
          <label for="reviewNights">Nights</label>
          <input id="reviewNights" name="nights" type="number" inputmode="numeric" min="1" max="${esc(content.dataset.maxNights)}" value="${booking.nights}" required>
        </div>
        <button type="submit" class="btn-secondary">Update stay</button>
      </div>
      <p id="reviewCapacity" class="field-help mt-2">Up to ${booking.roomCapacity} guests</p>
      <p id="reviewStayStatus" class="field-help mt-2" role="status"></p>
      <p id="reviewStayError" class="form-error mt-2" role="alert" tabindex="-1"></p>
    </form>`;
  }
  async function load() {
    try {
      const { reservation: r } = await request('/api/bookings/current');
      if (r) {
        const cancelled = r.status === 'CANCELLED';
        const payment = r.payments[0];
        const method = paymentLabel(payment?.payment_method);
        const paymentDisplay = payment?.card_last4 ? `${method} •••• ${payment.card_last4}` : method;
        content.innerHTML = `${steps(true, '')}<div class="checkout-grid"><section><div class="booking-result-mark">${icon('check')}</div><h1>${cancelled ? 'A change of plans.' : 'Your stay, a step closer.'}</h1><p class="result-intro">${cancelled ? 'Your booking has been cancelled. No payment was collected.' : 'Your booking details are saved. Keep your reference handy for your next visit.'}</p><div class="reference-strip"><div><span>Booking reference</span><strong id="bookingReference">${esc(r.reference)}</strong></div><button type="button" id="copyReference" class="btn-secondary" aria-label="Copy booking reference">Copy</button></div><span class="badge mb-6">${cancelled ? 'Cancelled' : r.status === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation'}</span><h2 class="form-heading">Guest details</h2><dl class="review-details">${row('Guest', `${r.first_name} ${r.last_name}`)}${row('Email address', r.email)}${row('Phone number', r.phone)}${row('Payment method', paymentDisplay)}</dl><div class="payment-note">${icon('lock')}<p>No payment has been collected. Hotel confirmation is pending.</p></div>${!cancelled ? refundPolicy : ''}<div class="result-actions no-print"><a id="print" class="btn-secondary" href="/receipt">Print receipt</a>${r.can_cancel ? '<button id="cancel" class="cancel-link">Cancel booking</button>' : ''}<a class="text-link" href="/">Plan another stay ${icon('arrow')}</a></div></section>${summary({ image: r.room.image, hotelName: r.hotel?.name, room: r.room_type, roomNumber: r.room_number, checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests, rate: r.nightly_rate, extra: r.extra_guest_nightly, total: r.total_amount })}</div>`;
        StayBook.configureSummaries();
        document.getElementById('copyReference').onclick = async e => { try { await navigator.clipboard.writeText(r.reference); e.target.textContent = 'Copied'; } catch { message.textContent = 'Select your booking reference and copy it manually.'; } };
        document.getElementById('cancel')?.addEventListener('click', () => { cancelError.textContent = ''; cancelDialog.showModal(); });
        return;
      }
      let { booking } = await request('/api/booking-preview');
      const roomQuery = () => new URLSearchParams({
        checkIn: booking.checkIn, checkOut: booking.checkOut, guests: booking.guests, hotelId: booking.hotelId || '',
      }).toString();
      const guestQuery = () => new URLSearchParams({
        checkIn: booking.checkIn, checkOut: booking.checkOut, guests: booking.guests, roomId: booking.roomId,
      }).toString();
      const staySummary = () => summary({
        image: booking.roomImage, hotelName: booking.hotelName, room: booking.roomType, roomNumber: booking.roomNumber,
        checkIn: booking.checkIn, checkOut: booking.checkOut, nights: booking.nights, guests: booking.guests,
        rate: booking.pricePerNight, extra: booking.extraGuestNightly, total: booking.totalAmount,
      });
      const saveLabel = () => `<span>Save booking · ${money(booking.totalAmount)}</span> ${icon('arrow')}`;

      content.innerHTML = `${steps(false, roomQuery())}
        <div class="checkout-grid">
          <section>
            <div class="page-intro"><h1>One last look.</h1><p>Check your stay and guest details before saving your booking.</p></div>
            ${reviewStay(booking)}
            <div class="review-heading">
              <h2 class="form-heading">Guest details</h2>
              <a data-review-details href="/guest-details?${esc(guestQuery())}" class="back-link">Edit details</a>
            </div>
            <dl class="review-details">
              ${row('Guest', `${booking.firstName} ${booking.lastName}`)}
              ${row('Email address', booking.email)}
              ${row('Phone number', booking.phone)}
              ${booking.address ? row('Address', booking.address) : ''}
            </dl>
            <form id="pay" class="payment-section">
              <h2 class="form-heading">Payment</h2>
              <p class="payment-availability">Payments are not connected yet. No money will be charged.</p>
              ${methodChoices()}
              <div class="mt-4">${refundPolicy}</div>
              <div class="form-actions mt-7">
                <a data-review-details class="back-link" href="/guest-details?${esc(guestQuery())}">Back to your details</a>
                <button type="submit" class="btn">${saveLabel()}</button>
              </div>
            </form>
          </section>
          ${staySummary()}
        </div>`;
      StayBook.configureSummaries();

      const stayForm = document.getElementById('reviewStay');
      const { guests, nights } = stayForm.elements;
      const updateButton = stayForm.querySelector('button');
      const stayError = document.getElementById('reviewStayError');
      const stayStatus = document.getElementById('reviewStayStatus');
      const payForm = document.getElementById('pay'), selectedMethod = configurePayment(payForm);
      const saveButton = payForm.querySelector('button[type=submit]');
      let updating = false, saving = false;
      const hasChanges = () => Number(guests.value) !== booking.guests || Number(nights.value) !== booking.nights;
      const syncButtons = () => {
        guests.disabled = nights.disabled = updateButton.disabled = updating || saving;
        saveButton.disabled = updating || saving || hasChanges();
      };
      const showTotal = () => {
        stayStatus.textContent = `${StayBook.t('Check-out')} ${dateLabel(booking.checkOut)} · ${StayBook.t('Total for your stay')} ${money(booking.totalAmount)}`;
      };

      showTotal();
      syncButtons();
      stayForm.addEventListener('input', () => {
        stayError.textContent = '';
        if (hasChanges()) stayStatus.textContent = StayBook.t('Update your stay to see the new total.');
        else showTotal();
        syncButtons();
      });
      stayForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (updating || saving) return;
        const changes = { guests: Number(guests.value), nights: Number(nights.value), requestKey: booking.requestKey };
        updating = true;
        stayError.textContent = '';
        message.textContent = '';
        stayForm.setAttribute('aria-busy', 'true');
        syncButtons();
        try {
          const result = await request('/api/booking-preview', { method: 'PATCH', body: changes });
          booking = result.booking;
          const currentSummary = content.querySelector('.stay-summary');
          const wasOpen = currentSummary.querySelector('details').open;
          currentSummary.outerHTML = staySummary();
          content.querySelector('.summary-disclosure').open = wasOpen;
          content.querySelector('[data-review-rooms]').href = '/rooms?' + roomQuery();
          content.querySelectorAll('[data-review-details]').forEach(link => { link.href = '/guest-details?' + guestQuery(); });
          saveButton.innerHTML = saveLabel();
          showTotal();
        } catch (error) {
          stayError.textContent = error.message;
          stayError.focus();
        } finally {
          updating = false;
          stayForm.removeAttribute('aria-busy');
          syncButtons();
        }
      });

      payForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (saveButton.disabled) return;
        const payment = selectedMethod();
        if (!payment) return;
        message.textContent = '';
        saving = true;
        payForm.setAttribute('aria-busy', 'true');
        syncButtons();
        try {
          await request('/api/bookings/confirm', { method: 'POST', body: { ...payment, requestKey: booking.requestKey } });
          selectedMethod.complete(payment.paymentMethod);
          await load();
          window.scrollTo({ top: 0 });
        } catch (error) {
          message.textContent = error.message;
          message.focus();
        } finally {
          saving = false;
          payForm.removeAttribute('aria-busy');
          syncButtons();
        }
      });
    } catch (error) { content.innerHTML = `<div class="empty-state"><h1>Let’s find your booking.</h1><p>${esc(error.message)}</p><a class="btn" href="/manage-booking">Find my booking</a><a class="btn-secondary ml-3" href="/">Start a new stay</a></div>`; }
  }
  load();
})();
