# FOOG Design Tokens — v1.0

Source of truth for the Next.js build. The two design files are `FOOG DS Foundations.dc.html` and `FOOG DS Components.dc.html`. The logo is `FoogMark.dc.html`, which takes the props `kind`, `ink`, `primary`, `accent`, `fCorner` and `dot`.

## Brand core
| Name | Hex | OKLCH |
|---|---|---|
| Volt (primary) | #C8F53A | oklch(0.91 0.2 124) |
| Midnight (secondary) | #0D1226 | oklch(0.18 0.045 268) |
| Signal Blue (accent) | #3D6BFF | oklch(0.6 0.21 262) |
| Chalk (neutral) | #F7F8F1 | oklch(0.975 0.006 120) |

## Theme tokens (dark = default)
| Token | Dark | Light |
|---|---|---|
| --bg | oklch(0.14 0.028 268) | oklch(0.972 0.004 265) |
| --surface | oklch(0.185 0.032 268) | oklch(1 0 0) |
| --surface-2 | oklch(0.225 0.034 268) | oklch(0.955 0.005 265) |
| --border | oklch(0.28 0.03 268) | oklch(0.91 0.006 265) |
| --border-strong | oklch(0.38 0.03 268) | oklch(0.8 0.01 265) |
| --text-1 | oklch(0.97 0.005 265) | oklch(0.18 0.045 268) |
| --text-2 | oklch(0.74 0.02 265) | oklch(0.44 0.025 265) |
| --text-3 | oklch(0.6 0.02 265) | oklch(0.58 0.02 265) |
| --primary | oklch(0.91 0.2 124) | same |
| --on-primary | oklch(0.18 0.045 268) | same |
| --brand-ink | Volt | Midnight |
| --accent | oklch(0.7 0.17 262) | oklch(0.55 0.21 262) |
| --success | oklch(0.76 0.15 158) | oklch(0.55 0.14 158) |
| --warning | oklch(0.83 0.15 80) | oklch(0.6 0.15 65) |
| --error | oklch(0.7 0.19 25) | oklch(0.55 0.21 25) |
| --inverse / --on-inverse | chalk / midnight | midnight / chalk |

Rules:
- Volt is used only as a fill, never as text on a light background.
- Use one primary (Volt) action per view.
- Success uses hue 158 so it never reads as Volt.

## Type
- Fonts: Archivo (UI) and JetBrains Mono (labels, stats, prices, times; always with tabular figures).
- Display: 72/72 at 800 weight, −3% tracking.
- H1: 48/52 at 800, −2%.
- H2: 34/40 at 700.
- H3: 24/30 at 700.
- Body: 16/24.
- Small: 14/20.
- Label: Mono 12/16 at 500, uppercase, +12% tracking.
- Button: 15/20 at 600.
- Caption: 12/16.
- Mobile sizes: display 44, H1 32, H2 26, H3 20.

## Spacing, radius, elevation
- **Spacing:** a 4px base with steps of 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 and 96.
- **Radius:** xs 6, sm 10 (inputs use 12), md 14, lg 20 (cards), xl 28 (sheets), and pill 999 for buttons and chips.
- **Elevation:** in the dark theme, show it with surface steps plus a 1px border. Reserve shadows for overlays.

## Layout
- **Desktop:** 1440px canvas, 1280px container, 12 columns, 80px margins, 24px gutters.
- **App shell:** 248px sidebar, 6-column feed, 3-column context panel.
- **Mobile:** 390px wide, 4 columns, 16px margins, 12px gutters. Touch targets are at least 44px.

## Motion
- **Durations:** 120ms (fast), 200ms (base), 320ms (slow).
- **Standard easing:** cubic-bezier(.2,.8,.2,1).
- **Kick easing:** cubic-bezier(.34,1.56,.64,1), used only for positive confirmations.

## Icons
- Material Symbols Rounded, weight 400, optical size 24.
- Outlined by default; filled for active and selected states.
