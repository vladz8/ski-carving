# The Physics of Ski Carving: website

A static website (no build step) explaining Vladislav (Vlad) Zalevskiy's home experiment on how a ski's carved turn radius depends on its edge angle. It is hosted on GitHub Pages from the root of the `main` branch.

## Files

- `index.html`: all page content and text. One `<section class="chapter">` per chapter, with ids `top` (title page), `ch1`–`ch6`, `results`, `ch8`, `ch9`, `about`.
- `styles.css`: design tokens at the top (`:root`, then the dark-mode overrides), followed by layout and component styles.
- `app.js`: one function per interactive figure (`fig1` … `fig9`, `figA`), plus the page behaviour: progress bar, side dots, "Go deeper" drop-downs and the scroll-in animation.
- `raw-notes.html`: the Raw Notes page linked from the top right (a placeholder for now).

## Working rules

- The text is Vlad's. Do not reword or "improve" it unless he asks for that exact change, and keep his first-person voice.
- Every number on the site must match the experiment record below. Never invent or round data differently from it.
- Keep it dependency-free: plain HTML, CSS and JavaScript. Fonts come from Google Fonts only.
- Use colours only through the CSS tokens, and give every new colour a dark-mode value too.
- Check changes at phone width (about 390 px) and on desktop. The page must never scroll sideways.
- Respect `prefers-reduced-motion`.
- After a change, tell Vlad in one or two plain sentences what changed and where.

## Layout pattern

Each chapter has a text column (number, title, main text, a "Go deeper" button with its drop-down) on one side and a figure panel on the other. `.chapter.flip` swaps the sides. On desktop the figure panel is sticky; on phones everything stacks in one column.

## Experiment record (source of truth: Vlad's Notion page "Physics of carvingg")

- Skis: Fischer SL 165 cm (printed radius 12 m) and Fischer GS 188 cm (printed radius 30 m).
- Sidecut radius from the half-width fit: SL 12.26 ± 0.09 m, GS 28.99 ± 0.39 m.
- Contact length: SL 1.4057 m, GS 1.6787 m. Sagitta over the contact length: SL 20.15 mm, GS 12.15 mm. Camber: SL 1.05 mm, GS 3.36 mm.
- Loaded traces, R measured vs R_sc · cos φ predicted:
  - SL 29.8°: 10.11 ± 0.69 m vs 10.64 m (average of two traces)
  - GS 29.4°: 25.20 ± 0.91 m vs 25.26 m
  - SL 44.0°: 9.00 ± 0.18 m vs 8.82 m
  - GS 45.0°: 21.25 ± 0.65 m vs 20.50 m
  - SL 57.9°: 6.48 ± 0.10 m vs 6.52 m
  - GS 59.1°: 14.41 ± 0.31 m vs 14.89 m
- Flat (0°) traces: SL 12.80 ± 0.34 m, GS 29.40 ± 1.23 m.
- Fit of R/R_sc = cos^n φ: n = 1.01 ± 0.02 using R_sc, n = 1.07 ± 0.04 from the traces alone; χ² = 3.8 for 6 points.
- Unloaded gap under the middle at 60°: paper stack SL 17 mm and GS 11.5 mm, against 18.1 mm and 12.2 mm predicted. The earlier ruler readings (SL 20 mm, GS 16 mm) read high at steep angles. Largest possible gap √(δ² + c²): SL 20.2 mm, GS 12.6 mm.
- Twist under load: at most 1.3°.
- Balanced-carve speed limit √(g · R_sc): SL 39.5 km/h, GS 60.7 km/h. Vlad's estimate from racing of where carving throws him off balance: SL 45–50 km/h, GS 65–70 km/h.
- References: Jentschura & Fahrbach (2004), Canadian Journal of Physics 82(4), 249–261; Komissarov (2022), Sports Biomechanics 21(8), 890–911; Komissarov (2023), Sports Biomechanics 22(9), 1209–1242.
