import { paymentMethods, paymentLabel } from './payment-methods.js';
(() => {
  const { request, money, escape: esc, icon } = StayBook;
  const content = document.getElementById('content'), message = document.getElementById('message');
  const row = (label, value) => `<div class="review-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString(StayBook.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const methodChoices = () => `<fieldset class="payment-choices"><legend class="muted mb-4">Choose a demo payment method</legend>${paymentMethods.map((method, index) => `<label class="payment-choice"><input type="radio" name="paymentMethod" value="${method.id}" ${index === 0 ? 'checked' : ''} required><span><strong data-no-translate>${method.label}</strong><small>${method.kind}</small></span><span class="badge">Demo</span></label>`).join('')}</fieldset><p class="field-help mt-4">No card, wallet login or bank details are collected. All methods simulate payment.</p>`;
  function summary({ image, room, roomNumber, checkIn, checkOut, nights, guests, rate, total }) {
    return `<aside class="stay-summary" aria-label="Your stay summary"><details class="summary-disclosure" open><summary class="summary-toggle"><span>Your stay</span><strong>${money(total)}</strong><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="summary-body">${image ? `<img src="${esc(image)}" alt="${esc(room)} interior, illustrative photograph" width="500" height="310">` : ''}<div class="summary-content"><h2>${esc(room)}</h2><p class="muted mt-2">Room ${esc(roomNumber)}</p><dl class="summary-dates"><div><dt>Check-in</dt><dd>${esc(dateLabel(checkIn))}</dd></div><div><dt>Check-out</dt><dd>${esc(dateLabel(checkOut))}</dd></div></dl><p class="muted summary-occupancy">${nights} ${nights === 1 ? 'night' : 'nights'} · ${guests} ${guests === 1 ? 'guest' : 'guests'}</p><div class="summary-rate"><span>${money(rate)} × ${nights} ${nights === 1 ? 'night' : 'nights'}</span><span>${money(total)}</span></div><div class="summary-total"><span>Total for your stay</span><strong>${money(total)}</strong></div></div></div></details></aside>`;
  }
  function steps(saved, backQuery) {
    return `<ol class="booking-steps" aria-label="Booking progress"><li>${saved ? '<span>1</span> Choose your room' : `<a href="/rooms?${esc(backQuery)}"><span>1</span> Choose your room</a>`}</li><li><span>2</span> Guest details</li><li aria-current="step"><span>3</span> ${saved ? 'Booking details' : 'Review booking'}</li></ol>`;
  }
  async function load() {
    try {
      const { reservation: r } = await request('/api/bookings/current');
      if (r) {
        const cancelled = r.status === 'CANCELLED';
        content.innerHTML = `${steps(true, '')}<div class="checkout-grid"><section><div class="booking-result-mark">${icon('check')}</div><h1>${cancelled ? 'A change of plans.' : 'Your stay, a step closer.'}</h1><p class="result-intro">${cancelled ? 'Your local booking has been cancelled. Its simulated payment has been refunded.' : 'Your booking details are saved. Keep your reference handy for your next visit.'}</p><div class="reference-strip"><div><span>Booking reference</span><strong id="bookingReference">${esc(r.reference)}</strong></div><button type="button" id="copyReference" class="btn-secondary" aria-label="Copy booking reference">Copy</button></div><span class="badge mb-6">${cancelled ? 'Cancelled' : 'Saved locally'}</span><h2 class="form-heading">Guest details</h2><dl class="review-details">${row('Guest', `${r.first_name} ${r.last_name}`)}${row('Email address', r.email)}${row('Phone number', r.phone)}${row('Payment', `${paymentLabel(r.payments[0]?.payment_method)} · ${r.payments[0]?.payment_status || '—'} · Simulated`)}</dl><div class="payment-note">${icon('lock')}<p>This is a local demo booking. No real money was charged. Hotel confirmation will be available after PMS integration.</p></div><div class="result-actions no-print"><button id="print" class="btn-secondary">Print booking</button>${!cancelled ? '<button id="cancel" class="cancel-link">Cancel booking</button>' : ''}<a class="text-link" href="/">Plan another stay ${icon('arrow')}</a></div></section>${summary({ image: r.room.image, room: r.room_type, roomNumber: r.room_number, checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests, rate: r.nightly_rate, total: r.total_amount })}</div>`;
        StayBook.configureSummaries();
        document.getElementById('print').onclick = () => {
          const details = [...document.querySelectorAll('.summary-disclosure')], states = details.map(d => d.open);
          details.forEach(d => { d.open = true; });
          try { print(); } finally { details.forEach((d, i) => { d.open = states[i]; }); }
        };
        document.getElementById('copyReference').onclick = async e => { try { await navigator.clipboard.writeText(r.reference); e.target.textContent = 'Copied'; } catch { message.textContent = 'Select your booking reference and copy it manually.'; } };
        document.getElementById('cancel')?.addEventListener('click', async e => {
          if (!confirm(StayBook.t('Cancel this local booking and refund its simulated payment?'))) return;
          e.target.disabled = true;
          try { await request('/api/bookings/cancel', { method: 'POST', body: {} }); message.textContent = ''; await load(); }
          catch (error) { message.textContent = error.message; message.focus(); e.target.disabled = false; }
        });
        return;
      }
      const { booking: p } = await request('/api/booking-preview');
      const backQuery = new URLSearchParams({ checkIn: p.checkIn, checkOut: p.checkOut, guests: p.guests }).toString();
      const detailsQuery = new URLSearchParams({ checkIn: p.checkIn, checkOut: p.checkOut, guests: p.guests, roomId: p.roomId }).toString();
      content.innerHTML = `${steps(false, backQuery)}<div class="checkout-grid"><section><div class="page-intro"><h1>One last look.</h1><p>Your room, your dates, your details. Check everything below before saving your booking.</p></div><div class="review-heading"><h2 class="form-heading">Guest details</h2><a href="/guest-details?${esc(detailsQuery)}" class="back-link">Edit details</a></div><dl class="review-details">${row('Guest', `${p.firstName} ${p.lastName}`)}${row('Email address', p.email)}${row('Phone number', p.phone)}${p.address ? row('Address', p.address) : ''}</dl><form id="pay" class="payment-section"><h2 class="form-heading">Payment</h2>${methodChoices()}<div class="payment-method">${icon('lock')}<div><strong>Demo payment</strong><p>No card details needed. This step simulates a successful payment; it does not charge real money.</p></div><span class="badge">Simulated</span></div><p class="field-help mt-4">Your booking is saved in this app only. It is not confirmed by a hotel or PMS yet.</p><div class="form-actions mt-7"><a class="back-link" href="/guest-details?${esc(detailsQuery)}">Back to your details</a><button class="btn">Save booking · ${money(p.totalAmount)} ${icon('arrow')}</button></div><details class="demo-options"><summary>Demo testing options</summary><label class="mt-3 flex items-center gap-2"><input type="checkbox" id="failure">Simulate a failed payment</label></details></form></section>${summary({ image: p.roomImage, room: p.roomType, roomNumber: p.roomNumber, checkIn: p.checkIn, checkOut: p.checkOut, nights: p.nights, guests: p.guests, rate: p.pricePerNight, total: p.totalAmount })}</div>`;
      StayBook.configureSummaries();
      document.getElementById('pay').addEventListener('submit', async e => {
        e.preventDefault(); message.textContent = ''; const button = e.target.querySelector('button'), original = button.innerHTML; button.disabled = true; button.textContent = 'Saving your booking…';
        try { await request('/api/bookings/confirm', { method: 'POST', body: { paymentMethod: new FormData(e.target).get('paymentMethod'), simulateFailure: document.getElementById('failure').checked } }); await load(); window.scrollTo({ top: 0 }); }
        catch (error) { message.textContent = error.message; message.focus(); button.disabled = false; button.innerHTML = original; }
      });
    } catch (error) { content.innerHTML = `<div class="empty-state"><h1>Let’s find your booking.</h1><p>${esc(error.message)}</p><a class="btn" href="/manage-booking">Find my booking</a><a class="btn-secondary ml-3" href="/">Start a new stay</a></div>`; }
  }
  load();
})();
