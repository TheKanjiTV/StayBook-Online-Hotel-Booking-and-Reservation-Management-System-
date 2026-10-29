# StayBook visual design

Refine the existing green-and-ivory identity into a welcoming hotel-booking experience. Keep the emphasis on dates, room photography, honest prices and a clear guest journey. The landing page introduces the stay; the remaining pages help the guest complete a booking with minimal distraction.

- Paper `#faf9f6`, deep green ink `#233e35`, secondary text `#626b63`, dividers `#dedfd7`, soft green surfaces `#eef1e9`.
- Self-hosted Cormorant Garamond for display headings and Manrope for controls/body copy. Their OFL licenses ship in `public/fonts/`.
- A 1240px page container, generous section spacing, 12–16px image/panel corners, and a consistent 48px control height. Use borders or a subtle shadow as appropriate; avoid nested decorative cards.
- Use the room catalog's actual local prices and descriptions. Photography is illustrative. Do not invent reviews, ratings, a hotel address, discounts, or verified hotel availability.
- Keep booking steps, totals, form labels, loading/empty/error states, keyboard focus and reduced-motion support consistent across pages.
- Room selection groups matching catalog entries, filters room types and shows nightly/whole-stay prices. Guest details and review use a two-column layout with a sticky stay summary; on phones the summary becomes a compact native disclosure above the form.
- My Booking pairs a short introduction with a restrained lookup form. Success/cancellation pages prioritize the reference, local status and next actions. Technical integration details stay in README; the payment/confirmation views retain the information a guest needs to understand that this is a demo.
- Preserve `.xian`, Tailwind, and all guest booking behavior. Payments remain simulated and PMS integration remains deferred.
- Keep the two-tier hotel header consistent: utility links, native language/currency controls and an account-only notification bell above the property navigation. Restaurants & Bars remains disabled until its destination exists. My StayBook is booking history and notifications, not an invented loyalty scheme.
- Account and directory pages inherit the same typography, controls and restrained image-led layouts. Nine interface languages include Arabic RTL; session preferences connect language to display currency without changing PHP accounting.
- The standalone receipt combines payment details above a room photograph and compact stay summary. It uses a 105 mm-wide paper layout with 240 mm print height, small document typography and explicit demo/refund status. It never imitates a real provider-issued payment proof.

Design guidance: [Impeccable](https://github.com/pbakaus/impeccable). Its context/detector launcher was unavailable in this environment, so the existing source and product scope were read directly and the refinement/craft guidance applied manually. Verification used the Tailwind build, MySQL/HTTP integration tests and real desktop/phone browser interactions, including an isolated browser-QA database.
