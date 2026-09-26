# Design — trim-mobile-chrome

## The number this is judged against

`.xterm`'s top, its height, and its share of a 390 x 664 viewport. Today:
**379 / 187 / 28%**. Everything below is costed in those three numbers.

The bottom of the terminal box is anchored by the key bar and does not move,
so every pixel taken off the header is a pixel the terminal gets. One xterm
row at the app's terminal font size measures 17px on the live pane, which is
where the row counts come from.

## Options, costed

Every row below is **measured** — the mock driven through each mode at the
iPhone-13 viewport, reading its own band. Nothing here is arithmetic.

| option | header | `.xterm` top | height | share |
| ------ | ---: | ---: | ---: | ---: |
| today | 298 | 379 | 187 (11 rows) | 28% |
| O1 identity on one row | 224 | 305 | 272 (16 rows) | 41% |
| O2 one navigator row | 250 | 331 | 238 (14 rows) | 36% |
| O3 meta on one line | 259 | 340 | 238 (14 rows) | 36% |
| O3b meta folded entirely | 227 | 308 | 272 (16 rows) | 41% |
| **O1+O2+O3 (recommended)** | **137** | **218** | **357 (21 rows)** | **54%** |
| O1+O2+O3b | 105 | 186 | 391 (23 rows) | 59% |
| O4 collapse on terminal focus, over the recommendation | 57 | 138 | 442 (26 rows) | 67% |

The `today` row is the mock's, and it lands on **379 / 187 / 28% / 11 rows** —
the live pane's numbers exactly. That agreement is what makes the rest of the
column trustworthy.

O4's numbers hold only while the terminal has focus; the header returns when
it does not.

The recommendation is O1+O2+O3: it triples the terminal's rows and leaves
the pane's status, its repo and the `files` toggle on screen. O3b buys two
more rows by taking the status off the header, which is the one readout an
operator watching an agent actually watches. That trade is the operator's to
make, which is why it is a control and not a decision here.

## Why these three rows

**Identity (row 1).** The back control is the only way out and stays the
first focusable element. The title is what the operator opened. The host
seal is 18px of information that does not deserve a row of its own — it is
an inline chip and it sits inline. `workspace / tab` is the thing that
moves: the tab name is already on the navigator row below it as the chip's
label, so the breadcrumb was saying half of what the next row says.

**Navigator (row 2).** Today the tab strip and the card switcher are two
40px rows expressing one idea — where this pane sits. The chip carries the
current tab and opens the rest under it; the sibling cards sit beside it.
Both levels stay on screen; only the *other* tabs move behind a tap, and
they are the level the operator changes least while watching one agent.

**Meta (row 3).** Status and `files` are the two live things in the strip.
The checkout path is a 403px string on a 390px viewport — it is already
overflowing its container today — and the pane id, revision and last-poll
elapsed are diagnostics. Diagnostics belong in the overflow.

## Rejected

- **Moving the meta strip into the file panel.** The panel is a view of a
  repo; the pane id, revision and last-poll elapsed are not repo facts. The
  panel is also closed by default, which would make the pane's status
  unreachable while watching it.
- **Header collapsing on page scroll.** There is no page scroll on pane
  detail: the view is a fixed-height flex column and the terminal owns its
  scrollback. There is no gesture to hang it on. Collapsing on *terminal
  focus* is the workable variant and is O4.
- **Hiding or shrinking the back control.** `docs/UX-GUIDELINES.md` § Pane
  detail requires it visible without scrolling and first in focus order. It
  stays a full `--touch-target-min` control at every setting.
- **Dropping the card switcher on a phone.** It is how the operator moves
  between the agents sharing a tab, and the whole reason the route exists at
  phone width. Merging it with the tab strip costs one row; removing it
  costs the loop.
- **A wordmark-free or shorter app header.** That is the board's chrome,
  10% of the viewport against the header's 45%, and
  `docs/UX-GUIDELINES.md` § Board — populated requires those four controls
  on one row. Not worth spending the spec change on.
- **Auto-hiding chrome on a timer.** An affordance that disappears on its
  own is hover-only with extra steps.

## The mock

`/labs/mobile-chrome/mock1`. A fake pane detail — its own header markup, a
stand-in terminal box, and the **real** key bar, which is what reserves the
bottom including the iOS safe-area inset a stand-in would not have. No
bridge call, no store, no xterm, and no product board or pane-detail
component mounted: a mock that mounted the real header would carry the real
header's answer instead of asking the question.

Four properties make it honest:

- With every control set back it measures **298px** — the real header's
  measured height to the pixel — because in that state it renders no control
  today's header does not have. The overflow trigger appears only once a
  mode has actually folded something away.
- The mocked pane is given the box the **real route** gets —
  `calc(100vh - (var(--touch-target-min) + var(--sp-6)))`, the viewport less
  the shell header — not the lab page's leftovers. The key bar is expanded
  and its reported reserve is taken off the body, exactly as
  `pane-detail.scss` does, so the stand-in box is not measured running under
  a bar that floats over it.
- The band reports **as if that pane owned the screen**: the terminal's top
  and share are measured inside the pane's box and offset by the shell
  header, never from the lab page, and the band says it is a simulation. The
  lab's own furniture sits above and below the mock, so a top measured from
  the page would say the proposal is worse than today. Set back, the band
  reads `379px of 664 · 187px · 28% · 11 rows` — the live pane's numbers.
- Its stand-in content is written at 120 columns, which is what herdr's
  headless PTY emits, and the page says so. Content fitted to the phone
  would make the reclaimed space look cleaner than the pane ever is.

The controls are **below** the mock and collapsed by default, so the phone's
first screen is the proposed header and the terminal box; the operator
scrolls to argue with it.

## What the port has to change in `terminal-top-bar`

Two shipped requirements are written as unconditional stacking rules and
become width-conditional:

- the meta strip "SHALL keep its own row beneath the title" — true at
  desktop widths, the third row on a phone, and its diagnostic half moves to
  the overflow;
- the tab level "above" the pane level — beside it below
  `--breakpoint-mobile`, with the tab as the chip that opens the rest.

Neither changes what the bar *derives* or where it navigates. The URL stays
the state, every entry stays a link, and no wire method is added.

## Not solved here

herdr never resizes a headless PTY, so the phone renders a ~120-column
stream into a ~40-column terminal
(`tmp/foreman/INVESTIGATION-viewport-notifications.md`). That is the other
half of why the phone reads cluttered and it is a separate lane against
`pane-terminal.ts`. This proposal stands on layout alone and does not depend
on it landing.
