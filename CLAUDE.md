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
- Every equation must have all its symbols explained, using the meanings in the Symbols section below: a "where" list directly under every display equation (`<div class="eq">`), and for maths inside a sentence (`<span class="m">`), each symbol named in words in the same sentence or the next one. Every symbol shown in a figure is named in words in that figure (slider label, readout or caption). One letter has one meaning across the whole site; a new symbol gets added to the Symbols section first.

## Layout pattern

Each chapter has a text column (number, title, main text, a "Go deeper" button with its drop-down) on one side and a figure panel on the other. `.chapter.flip` swaps the sides. On desktop the figure panel is sticky; on phones everything stacks in one column.

Reusable pieces inside the text:

- "where" list, directly after a display equation. One row per symbol; `.how` holds how Vlad got the value and the value(s); an optional last `note` row says where a number or maths fact comes from. Tags: `meas` (measured), `calc` (calculated), `fit` (fitted), `const` (constant), `var` (variable: a letter that can stand for any value).
  ```html
  <dl class="where">
    <div><dt><span class="m"><i>R</i><sub>sc</sub></span></dt><dd>sidecut radius, … (m) <span class="tag fit">fitted</span><span class="how">12.26 m (SL), 28.99 m (GS).</span></dd></div>
    <div class="from"><dt>note</dt><dd>Where the number comes from.</dd></div>
  </dl>
  ```
- `<ol class="steps">`: numbered steps for a derivation inside a drop-down.
- `<figure class="deeper-fig panel">`: a diagram inside a drop-down (drawn by `dg3`, `dg6`, `dg7` in app.js), so it only shows once the panel is open. On desktop app.js moves every drop-down into a full-width row under its chapter, with the diagram sticky beside the text.
- `<span class="eq-br"></span>`: a line break inside a long display equation that only applies on narrow screens.

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
- Unloaded gap under the middle at 60°: paper stack SL 17 mm and GS 11.5 mm, against 18.1 mm and 12.2 mm predicted. The earlier ruler readings (SL 20 mm, GS 16 mm) read high at steep angles. Largest possible gap √(δ² + h²), with h the camber: SL 20.2 mm, GS 12.6 mm.
- Twist under load: at most 1.3°.
- Balanced-carve speed limit √(g · R_sc): SL 39.5 km/h, GS 60.7 km/h. Vlad's estimate from racing of where carving throws him off balance: SL 45–50 km/h, GS 65–70 km/h.
- References on the site: Jentschura & Fahrbach, "Physics of skiing: the ideal-carving equation and its applications", arXiv physics/0310086 (https://arxiv.org/pdf/physics/0310086); "Physics of skiing", Real World Physics Problems (https://www.real-world-physics-problems.com/physics-of-skiing.html); Komissarov (2022), Sports Biomechanics 21(8), 890–911, cited in chapter 8.

## Symbols

One meaning per letter across the whole site. Type: measured, calculated, fitted, constant or variable (a letter that can stand for any value). Values are only those in the experiment record or already on the site; "not recorded" means the value is missing.

| Symbol | Meaning | Unit | Type | Value(s) |
|---|---|---|---|---|
| R | radius of a circle or arc; in a turn, the radius of the turn the ski carves | m | calculated (from c and s for a trace; from R_sc · cos φ for a prediction) | traces and predictions as in the record above |
| R_sc | sidecut radius: the radius of the circle the ski's sides are cut from | m | fitted (half-widths measured with a ruler every 10 cm) | SL 12.26 ± 0.09, GS 28.99 ± 0.39 (printed 12 and 30) |
| R_tipping only | radius the turn would have if the ski only tipped and kept its shape, R_sc / cos φ | m | calculated | 1.15, 1.41, 2 × R_sc at 30°, 45°, 60° |
| φ | edge angle: how far the ski is tipped from flat (in chapter 8 also the skier's lean from vertical) | ° | measured (phone inclinometer on the loaded ski); variable in general formulas | loaded: SL 29.8, 44.0, 57.9; GS 29.4, 45.0, 59.1; unloaded gaps: SL 60.5, GS 60.6 |
| c | chord: straight distance between the two contact points / the two ends of a pencil arc (= contact length) | m | measured (traces: string between the ends, ±5 mm) | contact length SL 1.4057, GS 1.6787; SL trace about 1.41 |
| s | sagitta: depth of an arc in the middle, measured from its chord | mm | calculated for the sidecut; measured (±0.5 mm) for traces | sidecut SL 20.15, GS 12.15; SL 44° trace 27.6 |
| δ | sidecut inset: how far a point of the edge is set in from the line between the contact points | mm | calculated | at the middle = sagitta: SL 20.15, GS 12.15 |
| h | camber: how high the middle of the base arches off the floor when the ski lies flat | mm | measured | SL 1.05, GS 3.36 |
| gap | height of the edge above the floor at the middle of the unloaded, tipped ski (written as a word, not a letter) | mm | measured (paper stack) | SL 17, GS 11.5 at about 60°; predicted 18.1, 12.2; largest possible 20.2, 12.6 |
| b | bend: how far the middle of the ski flexes, at right angles to its base, until the edge touches | mm | calculated | about 37 at the middle of the SL at 60° (34.9 without camber) |
| β | angle in δ sin φ + h cos φ = √(δ² + h²) · sin(φ + β), with tan β = h/δ | ° | calculated | not quoted |
| ζ | any extra lift of the edge at right angles to the base (camber, or a raised support) | mm | variable | – |
| x | position along the ski (from the narrowest point or from the middle mark) | m | variable | half-widths every 10 cm |
| x₀ | how far the middle mark is from the true narrowest point | m | variable | – |
| y | half-width: distance from the ski's centre line to its edge (counted from its value at the narrowest point in the circle equation) | m or mm | measured (ruler, 0.25 mm resolution) | not recorded |
| u | any number much smaller than 1, in √(1 − u) ≈ 1 − u/2 | – | variable | – |
| A, B, C | coefficients of the fit y = Ax² + Bx + C: A sets the radius (R_sc = 500/A), B soaks up the error in the middle mark, C is the half-width at the middle | mm/m², mm/m, mm | fitted | not recorded |
| n | power in R/R_sc = cos^n φ | – | fitted | 1.01 ± 0.02 (using R_sc), 1.07 ± 0.04 (traces alone) |
| χ² | sum of each point's squared miss from the curve, in units of its error bar | – | calculated | 3.8 for 6 points |
| ΔR, Δc, Δs | uncertainty in R, c, s | m, mm, mm | ΔR calculated; Δc, Δs measured (reading) | ΔR 2–4% per trace; Δc ±5 mm; Δs ±0.5 mm |
| v | the skier's speed | m/s (km/h on the site) | variable | – |
| g | gravitational acceleration | m/s² | constant | 9.81 |
| m | the skier's mass (mg is the weight) | kg | variable | – |
| F | push from the snow on the skier, mg / cos φ | N | calculated | 1.15, 1.41, 2 × body weight at 30°, 45°, 60° |
| α | angle of the slope | ° | variable | – |
