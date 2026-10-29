import { paymentMethods, paymentLabel } from './payment-methods.js';
import { cardBrand, formatCardNumber, validCardNumber } from './card.js';
(() => {
  const { request, money, escape: esc, icon } = StayBook;
  const content = document.getElementById('content'), message = document.getElementById('message');
  const row = (label, value) => `<div class="review-row"><dt>${esc(label)}</dt><dd ${label === 'Payment preference' ? '' : 'data-no-translate'}>${esc(value)}</dd></div>`;
  const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString(StayBook.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const methodChoices = () => `<fieldset class="payment-options"><legend class="form-heading mb-4">Choose a payment method</legend>${paymentMethods.filter(method => method.kind !== 'Card').map((method, index) => `<label class="payment-logo-choice"><input type="radio" name="paymentChoice" value="${method.id}" ${index === 0 ? 'checked' : ''} required><img class="payment-logo ${method.id === 'BANK_TRANSFER' ? 'bank-logo' : ''}" src="/payment-logos/${method.logo}" alt="${method.label}" width="140" height="42"><span class="payment-selection" aria-hidden="true">${icon('check')}</span></label>`).join('')}<label class="payment-logo-choice"><input type="radio" name="paymentChoice" value="CARD" required><img class="payment-logo card-logo" src="/payment-logos/card.svg" alt="Card" width="64" height="42"><span class="payment-selection" aria-hidden="true">${icon('check')}</span></label></fieldset><div id="cardFields" class="card-fields" hidden><label for="cardNumber">Card number</label><div class="card-number-wrap"><input id="cardNumber" type="text" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="0000 0000 0000 0000" aria-describedby="cardHelp" disabled><img id="cardBrandImage" src="/payment-logos/card.svg" alt="Card" width="64" height="42"></div><p id="cardHelp" class="field-help">Use a test card number. This field does not make a payment.</p><p id="cardBrandStatus" class="sr-only" role="status"></p></div>`;
  function configurePayment(form) {
    const number = document.getElementById('cardNumber'), fields = document.getElementById('cardFields'), image = document.getElementById('cardBrandImage');
    const status = document.getElementById('cardBrandStatus');
    function resetCard() { number.value = ''; number.setCustomValidity(''); number.removeAttribute('aria-invalid'); image.src = '/payment-logos/card.svg'; image.alt = StayBook.t('Card'); status.textContent = ''; }
    form.addEventListener('change', event => {
      if (event.target.name !== 'paymentChoice') return;
      const card = event.target.value === 'CARD'; fields.hidden = !card; number.disabled = !card; number.required = card;
      if (card) number.focus(); else resetCard();
    });
    number.addEventListener('input', () => {
      const cursor = number.selectionStart, atEnd = cursor === number.value.length, before = number.value;
      number.value = formatCardNumber(number.value);
      if (!atEnd && cursor !== null) number.setSelectionRange(Math.min(cursor + number.value.length - before.length, number.value.length), Math.min(cursor + number.value.length - before.length, number.value.length));
      number.setCustomValidity(''); number.removeAttribute('aria-invalid');
      const brand = cardBrand(number.value), method = paymentMethods.find(item => item.id === brand);
      image.src = `/payment-logos/${method?.logo || 'card.svg'}`; image.alt = method?.label || StayBook.t('Card');
      status.textContent = method ? `${method.label}` : '';
    });
    window.addEventListener('pagehide', resetCard, { once: true });
    return () => {
      const selected = form.querySelector('[name=paymentChoice]:checked').value;
      if (selected !== 'CARD') return selected;
      if (!validCardNumber(number.value)) { number.setCustomValidity(StayBook.t('Enter a valid Visa or Mastercard test number.')); number.setAttribute('aria-invalid', 'true'); number.reportValidity(); number.focus(); return null; }
      return cardBrand(number.value);
    };
  }
  function summary({ image, hotelName, room, roomNumber, checkIn, checkOut, nights, guests, rate, total }) {
    return `<aside class="stay-summary" aria-label="Your stay"><details class="summary-disclosure" open><summary class="summary-toggle"><span>Your stay</span><strong>${money(total)}</strong><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="summary-body">${image ? `<img src="${esc(image)}" alt="${esc(room)} interior, illustrative photograph" width="500" height="310">` : ''}<div class="summary-content"><h2>${esc(room)}</h2><p class="muted mt-2" data-no-translate>${esc(hotelName || '')}</p><p class="muted mt-2">Room ${esc(roomNumber)}</p><dl class="summary-dates"><div><dt>Check-in</dt><dd>${esc(dateLabel(checkIn))}</dd></div><div><dt>Check-out</dt><dd>${esc(dateLabel(checkOut))}</dd></div></dl><p class="muted summary-occupancy">${nights} ${nights === 1 ? 'night' : 'nights'} · ${guests} ${guests === 1 ? 'guest' : 'guests'}</p><div class="summary-rate"><span>${money(rate)} × ${nights} ${nights === 1 ? 'night' : 'nights'}</span><span>${money(total)}</span></div><div class="summary-total"><span>Total for your stay</span><strong>${money(total)}</strong></div></div></div></details></aside>`;
  }
  function steps(saved, backQuery) {
    return `<ol class="booking-steps" aria-label="Booking progress"><li>${saved ? '<span>1</span> Choose your room' : `<a href="/rooms?${esc(backQuery)}"><span>1</span> Choose your room</a>`}</li><li><span>2</span> Guest details</li><li aria-current="step"><span>3</span> ${saved ? 'Booking details' : 'Review booking'}</li></ol>`;
  }
  async function load() {
    try {
      const { reservation: r } = await request('/api/bookings/current');
      if (r) {
        const cancelled = r.status === 'CANCELLED';
        content.innerHTML = `${steps(true, '')}<div class="checkout-grid"><section><div class="booking-result-mark">${icon('check')}</div><h1>${cancelled ? 'A change of plans.' : 'Your stay, a step closer.'}</h1><p class="result-intro">${cancelled ? 'Your booking has been cancelled. No payment was collected.' : 'Your booking details are saved. Keep your reference handy for your next visit.'}</p><div class="reference-strip"><div><span>Booking reference</span><strong id="bookingReference">${esc(r.reference)}</strong></div><button type="button" id="copyReference" class="btn-secondary" aria-label="Copy booking reference">Copy</button></div><span class="badge mb-6">${cancelled ? 'Cancelled' : 'Awaiting confirmation'}</span><h2 class="form-heading">Guest details</h2><dl class="review-details">${row('Guest', `${r.first_name} ${r.last_name}`)}${row('Email address', r.email)}${row('Phone number', r.phone)}${row('Payment preference', paymentLabel(r.payments[0]?.payment_method))}</dl><div class="payment-note">${icon('lock')}<p>No payment has been collected. Hotel confirmation is pending.</p></div><div class="result-actions no-print"><a id="print" class="btn-secondary" href="/receipt">Print receipt</a>${!cancelled ? '<button id="cancel" class="cancel-link">Cancel booking</button>' : ''}<a class="text-link" href="/">Plan another stay ${icon('arrow')}</a></div></section>${summary({ image: r.room.image, hotelName: r.hotel?.name, room: r.room_type, roomNumber: r.room_number, checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests, rate: r.nightly_rate, total: r.total_amount })}</div>`;
        StayBook.configureSummaries();
        document.getElementById('copyReference').onclick = async e => { try { await navigator.clipboard.writeText(r.reference); e.target.textContent = 'Copied'; } catch { message.textContent = 'Select your booking reference and copy it manually.'; } };
        document.getElementById('cancel')?.addEventListener('click', async e => {
          if (!confirm(StayBook.t('Cancel this booking?'))) return;
          e.target.disabled = true;
          try { await request('/api/bookings/cancel', { method: 'POST', body: {} }); message.textContent = ''; await load(); }
          catch (error) { message.textContent = error.message; message.focus(); e.target.disabled = false; }
        });
        return;
      }
      const { booking: p } = await request('/api/booking-preview');
      const backQuery = new URLSearchParams({ checkIn: p.checkIn, checkOut: p.checkOut, guests: p.guests, hotelId: p.hotelId || '' }).toString();
      const detailsQuery = new URLSearchParams({ checkIn: p.checkIn, checkOut: p.checkOut, guests: p.guests, roomId: p.roomId }).toString();
      content.innerHTML = `${steps(false, backQuery)}<div class="checkout-grid"><section><div class="page-intro"><h1>One last look.</h1><p>Your room, your dates, your details. Check everything below before saving your booking.</p></div><div class="review-heading"><h2 class="form-heading">Guest details</h2><a href="/guest-details?${esc(detailsQuery)}" class="back-link">Edit details</a></div><dl class="review-details">${row('Guest', `${p.firstName} ${p.lastName}`)}${row('Email address', p.email)}${row('Phone number', p.phone)}${p.address ? row('Address', p.address) : ''}</dl><form id="pay" class="payment-section"><h2 class="form-heading">Payment</h2><p class="payment-availability">Payments are not connected yet. No money will be charged.</p>${methodChoices()}<div class="form-actions mt-7"><a class="back-link" href="/guest-details?${esc(detailsQuery)}">Back to your details</a><button class="btn">Save booking · ${money(p.totalAmount)} ${icon('arrow')}</button></div></form></section>${summary({ image: p.roomImage, hotelName: p.hotelName, room: p.roomType, roomNumber: p.roomNumber, checkIn: p.checkIn, checkOut: p.checkOut, nights: p.nights, guests: p.guests, rate: p.pricePerNight, total: p.totalAmount })}</div>`;
      StayBook.configureSummaries();
      const payForm = document.getElementById('pay'), selectedMethod = configurePayment(payForm);
      payForm.addEventListener('submit', async e => {
        e.preventDefault(); const paymentMethod = selectedMethod(); if (!paymentMethod) return; message.textContent = ''; const button = e.target.querySelector('button'), original = button.innerHTML; button.disabled = true; button.textContent = 'Saving your booking…';
        try { await request('/api/bookings/confirm', { method: 'POST', body: { paymentMethod } }); document.getElementById('cardNumber').value = ''; await load(); window.scrollTo({ top: 0 }); }
        catch (error) { message.textContent = error.message; message.focus(); button.disabled = false; button.innerHTML = original; }
      });
    } catch (error) { content.innerHTML = `<div class="empty-state"><h1>Let’s find your booking.</h1><p>${esc(error.message)}</p><a class="btn" href="/manage-booking">Find my booking</a><a class="btn-secondary ml-3" href="/">Start a new stay</a></div>`; }
  }
  load();
})();
