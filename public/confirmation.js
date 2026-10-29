const { request, money, escape: esc } = StayBook;
const content = document.getElementById('content'), message = document.getElementById('message');
const row = (label, value) => `<div class="flex justify-between gap-5 py-2 border-b border-slate-100"><dt class="text-slate-500">${esc(label)}</dt><dd class="text-right">${esc(value)}</dd></div>`;
async function load() {
  try {
    const { reservation: r } = await request('/api/bookings/current');
    if (r) {
      content.innerHTML = `<p class="text-sm text-emerald-800 mb-2">${esc(r.reference)}</p><h1>Booking saved locally</h1>
        <dl class="text-sm mt-6">${row('Guest', `${r.first_name} ${r.last_name}`)}${row('Email', r.email)}${row('Room', r.room_name)}${row('Check-in', r.check_in)}${row('Check-out', r.check_out)}${row('Guests', r.guests)}${row('Total', money(r.total_amount))}${row('Payment', r.payments[0]?.payment_status || '—')}</dl>
        <p class="my-5 text-sm text-amber-800">This booking and simulated payment are saved in the online booking system only. No real money was charged. The PMS is not connected, so this is not a PMS-confirmed hotel reservation.</p>
        <div class="flex flex-wrap gap-3 no-print"><button id="print" class="btn-secondary">Print booking</button><a class="btn" href="/">Book another room</a></div>`;
      document.getElementById('print').onclick = () => print();
      return;
    }
    const { booking: p } = await request('/api/booking-preview');
    content.innerHTML = `<h1>Review your booking</h1><p class="muted mt-3 mb-6">Check your details before saving this local booking.</p><dl class="text-sm">
      ${row('Guest', `${p.firstName} ${p.lastName}`)}${row('Email', p.email)}${row('Phone', p.phone)}${row('Room', p.roomName)}${row('Check-in', p.checkIn)}${row('Check-out', p.checkOut)}${row('Guests', p.guests)}${row('Nights', p.nights)}${row('Nightly rate', money(p.pricePerNight))}${row('Total', money(p.totalAmount))}</dl>
      <form id="pay" class="mt-6 space-y-4 no-print"><div class="border border-amber-200 bg-amber-50 rounded-md p-4 text-sm"><strong>Local payment simulator</strong><p class="mt-1">No real money will be charged. This saves a booking in your online booking database only. Connection to the PMS will be added later.</p></div>
      <label class="flex gap-2 items-center"><input type="checkbox" id="failure">Test a failed payment</label><button class="btn w-full">Save local booking · ${money(p.totalAmount)}</button><a class="block text-center text-sm text-slate-600" href="/">Change dates or room</a></form>`;
    document.getElementById('pay').addEventListener('submit', async e => {
      e.preventDefault(); message.textContent = ''; const button = e.target.querySelector('button'); button.disabled = true;
      try { await request('/api/bookings/confirm', { method: 'POST', body: { simulateFailure: document.getElementById('failure').checked } }); await load(); } catch (error) { message.textContent = error.message; button.disabled = false; }
    });
  } catch (error) { content.textContent = 'Booking details could not be loaded.'; message.textContent = error.message; }
}
load();
