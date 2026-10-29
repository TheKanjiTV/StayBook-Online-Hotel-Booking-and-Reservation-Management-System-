# StayBook visual design

Refine the existing green-and-ivory identity into a welcoming hotel-booking experience. Keep the emphasis on dates, room photography, honest prices and a clear guest journey. The landing page introduces the stay; the remaining pages help the guest complete a booking with minimal distraction.

- Paper `#faf9f6`, deep green ink `#233e35`, secondary text `#626b63`, dividers `#dedfd7`, soft green surfaces `#eef1e9`.
- Self-hosted Cormorant Garamond for display headings and Manrope for controls/body copy. Their OFL licenses ship in `public/fonts/`.
- A 1240px page container, generous section spacing, 12–16px image/panel corners, and a consistent 48px control height. Use borders or a subtle shadow as appropriate; avoid nested decorative cards.
- Use the room catalog's actual local prices and descriptions. Photography is illustrative. Do not invent reviews, ratings, a hotel address, discounts, or verified hotel availability.
- Keep booking steps, totals, form labels, loading/empty/error states, keyboard focus and reduced-motion support consistent across pages.
- Preserve `.xian`, Tailwind, and all guest booking behavior. Payments remain simulated and PMS integration remains deferred.

Design guidance: [Impeccable](https://github.com/pbakaus/impeccable). Its context launcher was unavailable in this environment, so the existing source and product scope were read directly and the refinement/craft guidance applied manually.
