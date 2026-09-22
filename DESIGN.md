# Design

<!-- impeccable:design-schema 1 -->

Visual authority for Fauxbox. PRODUCT.md holds product truth; this holds the
committed visual world. When they disagree, PRODUCT.md wins on facts, this wins
on look and feel.

## Direction: Signal Room

Fauxbox is a capture instrument. Applications under test emit email; Fauxbox
intercepts each one as a **captured signal** and lays it out for inspection. So
the dashboard is built like a protocol / network inspector (the register of
Chrome DevTools' Network panel, Wireshark, a logic analyzer), refined to
instrument-grade craft rather than shipped as a raw debugger.

This is an **Operate** surface. Scanability, density, and status legibility
outrank expression; the brand lives in precise details, not decoration.

Committed, and what it rejects:

- Color is **functional first**. Message state (delivered, queued, warning,
  error) and size/timing are color- and bar-coded the way a network panel codes
  status. The brand accent (signal blue) is distinct from every status hue so a
  blue element never reads as "info status".
- Dark-first, chosen from the use scene (an engineer with the panel open beside
  a dark editor for hours), with a real daylight light mode of equal quality.
- **Matte, not neon.** No glow, no gradient text, no glass-as-decoration. Depth
  is hairlines, tonal surface layers, and offset+blur shadows. This is the line
  that keeps Signal Room out of the "OLED black + one neon accent + glow" rut
  that the category ships by default.
- Monospace is earned, not a costume: it carries machine data only (addresses,
  headers, timings, sizes, sandbox IDs, raw source), never body copy or buttons.

## Palette

Tokens are CSS variables on `:root` (dark = default) and `:root[data-theme="light"]`,
plus a `prefers-color-scheme: light` fallback for first paint. All body/placeholder
text pairs at >=4.5:1 on its surface; large text >=3:1.

### Dark (default) — "the scope screen"

Blue-graphite ground, layered so surfaces read without borders alone.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0B0F14` | app background |
| `--surface` | `#111722` | panels, cards |
| `--surface-2` | `#161E2B` | rows, insets |
| `--elevated` | `#1B2432` | popovers, dialogs, dropdowns |
| `--border` | `#232E3D` | hairline dividers |
| `--border-strong` | `#2E3A4C` | inputs, focus containers |
| `--fg` | `#E6EDF5` | primary text |
| `--muted` | `#94A3B4` | secondary text (>=4.5:1 on bg/surface) |
| `--faint` | `#8593A6` | tertiary text: metadata, previews, placeholders (>=4.5:1 on every surface it labels) |

### Accent — "signal"

| Token | Value | Role |
|---|---|---|
| `--accent` | `#3E8EFF` | primary actions, active nav, links, focus ring |
| `--accent-hover` | `#5B9FFF` | hover |
| `--accent-fg` | `#08111C` | text on accent fills (dark text, >=5:1) |
| `--accent-weak` | `rgba(62,142,255,0.14)` | tints, selection, active row |

### Status (functional coding, distinct from accent)

| Token | Dark | Role |
|---|---|---|
| `--ok` | `#35C88A` | delivered / valid / 2xx |
| `--warn` | `#E5A33B` | warning / 4xx / large |
| `--error` | `#F0616D` | failed / bounced / 5xx / destructive |
| `--error-fg` | `#0A0F14` | text on error fills (dark, since error is light here) |
| `--pending` | `#A78BFA` | queued / processing |
| `--capture` | `#34D3E0` | live-capture indicator only (pulses) |

### Light — "daylight scope"

| Token | Value |
|---|---|
| `--bg` | `#F6F8FA` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F0F3F6` |
| `--elevated` | `#FFFFFF` |
| `--border` | `#E2E8F0` |
| `--border-strong` | `#CBD5E1` |
| `--fg` | `#0F1826` |
| `--muted` | `#526072` |
| `--faint` | `#5A6675` |
| `--accent` | `#1F6FEB` |
| `--accent-hover` | `#1A5FD0` |
| `--accent-fg` | `#FFFFFF` |
| `--accent-weak` | `rgba(31,111,235,0.10)` |
| `--ok` | `#17935F` |
| `--warn` | `#B26A00` |
| `--error` | `#D33A48` |
| `--error-fg` | `#FFFFFF` |
| `--pending` | `#7C5CD6` |
| `--capture` | `#0E8FA0` |

## Typography

- **UI / body:** Geist (via `next/font`). Clean technical grotesk; developer-native.
- **Machine data:** JetBrains Mono (via `next/font`). Addresses, headers, timings,
  sizes, IDs, raw source, filter tokens. Tabular numerals on for aligned data.
- Tracking floor `-0.02em` on headings; body `0`.

Scale (px; app base 14 for density, reading contexts step up):
`--t-2xs 11 / --t-xs 12 / --t-sm 13 / --t-base 14 / --t-md 15 / --t-lg 17 /
--t-xl 20 / --t-2xl 25 / --t-3xl 32 / --t-4xl 42`.
Line-height: headings 1.15, body 1.5, dense tables 1.4.

## Space, radius, depth, motion

- **Space** (4px base): `2 4 6 8 10 12 16 20 24 32 40 48 64`.
- **Radius** (precise, instrument-like): `--r-xs 3 / --r-sm 5 / --r-md 7 / --r-lg 10 / --r-full 999`.
- **Depth:** `--shadow-1: 0 1px 2px rgba(0,0,0,.30)`, `--shadow-2: 0 8px 24px -6px rgba(0,0,0,.45)`,
  `--shadow-3: 0 20px 48px -12px rgba(0,0,0,.55)`. Offset + blur, never a zero-offset halo.
- **Motion:** durations 120 / 180 / 240 ms; ease-out `cubic-bezier(0.2,0,0,1)`,
  snappy `cubic-bezier(0.3,0.7,0.2,1)`. One authored moment: a captured message
  slides into the stream from the top with a 1px accent leading edge that fades
  (`capture-in`). Live indicator pulses (2s). Everything respects
  `prefers-reduced-motion`.

## Signature details

1. **Capture stream** — the inbox is a live waterfall; new messages land at the
   top with a brief accent left-edge pulse and a mono timestamp. A live indicator
   (pulsing `--capture` dot + `CAPTURING` mono label) sits in the top bar.
2. **Status rail** — each message row has a 2px left color rail keyed to state,
   plus mono metadata (size, parts, age). (The rail is the one sanctioned colored
   left-edge; it is 2px and part of the status system, not card decoration.)
3. **Size bars** — inline micro-bars show relative message size, network-waterfall
   style.
4. **Inspector viewer** — message detail is a tabbed inspector: Preview / HTML /
   Text / Headers / Raw / Attachments. Header and MIME-part data render as mono
   key/value tables; untrusted HTML renders in a sandboxed `<iframe>`.
5. **Filter bar** — search is a mono filter-syntax input; applied filters become
   query-param-style token chips (`to:`, `is:unread`, `has:attachment`).
6. **Sandbox switcher** — framed as selecting a capture interface: mono sandbox
   ID, subdomain, and connection dot.

## Components (foundation)

Tokens -> `globals.css` (CSS vars + Tailwind v4 `@theme`). Primitives in
`components/ui`: Button, Input, Tabs, Table, Badge/Tag, Dialog (native
`<dialog>`), Toast (context). Shell in `components/shell`: TopBar, Sidebar,
SandboxSwitcher, CaptureIndicator. Icons from `lucide-react` (one stroke weight).
Proof surfaces built this phase: `/login`, `/inbox`.

## Accessibility

WCAG 2.2 AA. Visible focus ring (`--accent`, 2px offset) on every interactive
element; status never conveyed by color alone (paired icon/label); custom
scrollbar, caret, selection, and focus themed from the palette;
`prefers-reduced-motion` honored.
