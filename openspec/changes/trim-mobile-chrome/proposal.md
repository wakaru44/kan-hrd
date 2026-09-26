## Why

The operator's report: "the top of app is consuming too much vertical
space" on mobile. Measured, at the iPhone-13 viewport the `mobile`
Playwright project already uses (390 x 664 CSS px), against the live bridge
on `/pane/local/w6:pJM`:

| element | y | height | % of 664 |
| ------- | --- | ---: | ---: |
| app header (wordmark, theme, settings) | 0-64 | 64 | 10% |
| **`.detail-header`** | 64-362 | **298** | **45%** |
| `.xterm` | 379-566 | 187 | 28% |
| key bar | 620-664 | 44 | 7% |

The terminal's first row starts at **y=379**: 57% of the screen is spent
before the pane says anything, and eleven rows are what is left for it.

The 298px is seven stacked rows, each carrying one short thing:

| row | y | height |
| --- | --- | ---: |
| back / next-card / breadcrumb | 72-112 | 40 |
| `.title-row` | 120-160 | 40 |
| `.host-seal` | 168-186 | 18 |
| `app-tab-strip` | 194-234 | 40 |
| `app-card-switcher` | 242-282 | 40 |
| `.meta-strip` (three wrapped lines) | 290-353 | 63 |

Five 40px rows for five short strings. The app header is the small half of
the problem and is not what this change touches.

Full audit, method and per-option arithmetic:
`tmp/foreman/AUDIT-mobile-chrome.md`.

## What Changes

Below `--breakpoint-mobile`, the pane-detail header becomes **three rows**
instead of seven:

1. **identity** — back, next-card, pane title, host seal, and an overflow
   for everything folded off. One 40px row.
2. **navigator** — the tab as a chip that opens the workspace's tabs, and
   the current tab's cards beside it. One 40px row instead of two.
3. **meta** — status and the `files` toggle on one line. Checkout path,
   pane id, revision and last-poll elapsed move into the overflow.

Measured on the real route at 390x664 after the port: header
**298px -> 137px**, `.xterm` top **379 -> 218**, height **187 -> 357**,
**11 rows -> 21**, **28% -> 54%** of the viewport. While the terminal has
focus the header is **57px** and the terminal is **442px / 26 rows / 67%**.

Nothing becomes hover-only, nothing moves behind a gesture, and the back
control stays the header's first focusable element at every setting. What
comes off the header is two taps away in a visible `LucideMoreHorizontal`
overflow, never gone.

**The mock came first and is gone.** `/labs/mobile-chrome/mock1` put all
four cuts behind visible controls and reported the measured top of the
terminal box live on the device; the operator ruled on their own iPhone and
took all four. This change ports the ruling into `pane-detail/` and deletes
the mock, its route and its tests, as `labs-surface` requires of the change
that supersedes a lab.

## Not in scope

The terminal renders a 120-column stream into a terminal the fit addon
sized for ~40 columns, because herdr never resizes a headless PTY
(`tmp/foreman/INVESTIGATION-viewport-notifications.md`). That is a second,
independent cause of the clutter and belongs to a separate lane against
`apps/web/src/app/pane-detail/pane-terminal.ts`. This proposal stands on
layout alone; the mock renders its stand-in content at 120 columns and says
so on the page, so the space given back is not shown cleaner than the pane
ever is.

The board's own top chrome (app header, filter bar, status switcher) is
not touched.

## Decisions the operator made on the device

All four, on their own iPhone, against `/labs/mobile-chrome/mock1`. No
alternative survives; the mock's defaults are what shipped.

1. **q1 identity — ONE ROW.** Back, next-card, title, host seal and the
   overflow. `workspace / tab` moves under the overflow.
2. **q2 navigator — ONE STRIP.** The tab is a disclosure chip; the cards of
   that tab sit beside it. `terminal-top-bar`'s "tab level **above** pane
   level" becomes "beside" at this width.
3. **q3 meta — ONE LINE.** Status and the `files` toggle stay visible; the
   diagnostics go under the overflow. Not folded — the status word stays.
4. **q4 while the terminal has focus — COLLAPSE.** The header drops to the
   identity row while the keyboard is up. A press anywhere in the header
   brings it back, and a touch press keeps the terminal's focus so the
   keyboard is not dismissed.
5. **The overflow's glyph.** `LucideMoreHorizontal`, already the sanctioned
   overflow trigger in `docs/DESIGN-SYSTEM.md`. No twenty-third icon, and no
   new copy: the trigger takes `copy.nav.moreActions` and the tab disclosure
   takes `copy.nav.tabStrip`.

## Impact

- **Affected specs:** `terminal-top-bar` — two ADDED requirements (the row
  budget, the collapse) and three MODIFIED (the meta strip's row, the
  breadcrumb at 390px, the tab level's placement). `labs-surface` is
  untouched: the mock arrived and left inside this one change, so the
  persistent spec never needs to record it.
- **Affected code:** `apps/web/src/app/pane-detail/pane-detail.{ts,html,scss}`
  plus a new `pane-detail.mobile.scss`; `apps/web/e2e/mobile.spec.ts`.
  Deleted: `apps/web/src/app/labs/mobile-chrome/**` and its route in
  `apps/web/src/app/app.routes.ts`.
- **Affected docs:** `docs/UX-GUIDELINES.md` § Mobile → Pane detail still
  says the back control renders with its label at 390px and that the
  metadata strip wraps beneath the title. Both are now false at that width.
  A maintainer owns that edit; this lane is scoped out of `docs/`.
- **No change to:** the bridge, the wire, `shared/copy.ts`, `tab-strip.ts`,
  `card-switcher.ts` — the merge reuses both widgets as they are, with their
  keyboard contracts intact.
