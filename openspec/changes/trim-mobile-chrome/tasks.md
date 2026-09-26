# Tasks — trim-mobile-chrome

## 1. Audit (done)

- [x] 1.1 Measure the pane-detail header element by element at the
      iPhone-13 viewport, against the live bridge, read-only. Recorded in
      `tmp/foreman/AUDIT-mobile-chrome.md`.
- [x] 1.2 Cost each option as `.xterm` top / height / share of 664px, in
      `design.md`.
- [x] 1.3 Record the two things the audit found that were not the
      complaint: `.checkout-path` renders 403px wide inside a 390px
      viewport, and no board surface consumes a safe-area inset although
      `index.html` sets `viewport-fit=cover`.

## 2. The mock (done)

- [x] 2.1 `apps/web/src/app/labs/mobile-chrome/mock1/` — component,
      template, stylesheet and fixture. Tokens only, lucide only, no bridge
      call, no product board or pane-detail component mounted.
- [x] 2.2 All four questions as visible control groups in the lab band.
- [x] 2.3 Live readout of the stand-in terminal's top, height, percentage
      and whole-row count.
- [x] 2.4 Stand-in content written at the headless PTY's column count, with
      the caveat on the page.
- [x] 2.5 `mock1.spec.ts`: the contract, plus a geometry suite that gives
      the component the phone's box and asserts the header heights.

## 3. Route registration (foreman-inline)

- [x] 3.1 Added the lazy route to `apps/web/src/app/app.routes.ts`, beside
      the file-explorer lab and above `**`:

      ```ts
      {
        path: 'labs/mobile-chrome/mock1',
        loadComponent: () =>
          import('./labs/mobile-chrome/mock1/mock1').then((m) => m.MobileChromeMock1),
      },
      ```

      This is the one permitted edge from product code into `labs/`
      (`labs-surface`, "The dependency arrow points into labs only"). The
      lane that wrote the mock is scoped out of `app.routes.ts`.

- [x] 3.2 On device the lab furniture buried the mock and the band's headline
      number was measured from the lab page, which read as if the proposal
      were worse than today. Fixed: the questions moved below the mock and
      collapsed by default, the mocked pane given the real route's box, and
      every number reported as if that pane owned the screen. Verified at
      390x664 against the running bridge — set back, the band reports the
      live pane's own `379px of 664 · 187px · 28% · 11 rows`.

## 4. Operator validation (done)

- [x] 4.1 Operator opened `/labs/mobile-chrome/mock1` on their iPhone and
      ruled on all four questions.
- [x] 4.2 The ruling: q1 **one row**, q2 **one strip**, q3 **one line** (not
      folded — the status word stays visible), q4 **collapse**. Their words:
      "I love the mock, it works great, you moved the things exactly where I
      wanted to move them."

## 5. The port (done)

- [x] 5.1 `pane-detail.{ts,html,scss}` + a new `pane-detail.mobile.scss`:
      three rows below `--breakpoint-mobile` — identity, navigator, meta —
      with the overflow carrying the breadcrumb, checkout path, pane id,
      revision, last-poll elapsed, the stale marker and the rename control.
      `.identity` and `.navigator` are `display: contents` above the
      breakpoint, so the desktop header renders exactly the children it
      always has.
- [x] 5.2 The navigator merge reuses `TabStrip` and `CardSwitcher`
      unmodified: the chip discloses the same strip desktop shows above the
      switcher, every entry is still a link, and both keyboard contracts
      (roving tabindex, arrows, Home/End, `Escape` back to the terminal) are
      untouched. `prefix + n` / `prefix + p` / `prefix + o` are unaffected —
      they never went through the strip.
- [x] 5.3 Collapse on terminal focus, reversed by a press anywhere in the
      header or by the terminal losing focus. A touch press on a
      non-control prevents its own default so the terminal keeps focus and
      the soft keyboard stays up; a mouse press is left alone. A press in
      the terminal collapses it again even when focus never moved.
- [x] 5.4 The header's height change refits the terminal through the
      existing `ResizeObserver` on `.terminal-container`; no second observer.
- [x] 5.5 `apps/web/e2e/mobile.spec.ts`: criteria [39]-[42] assert the row
      budget and the terminal's share, the merged navigator and its
      disclosure, the overflow's contents, and the collapse plus its
      one-tap reversal with focus retained. [26] now asserts the back
      control's accessible name rather than its rendered label.
- [x] 5.6 Deleted `/labs/mobile-chrome/mock1`, its route object in
      `app.routes.ts` and its tests.
- [ ] 5.7 **Maintainer edit, outside this lane's scope.**
      `docs/UX-GUIDELINES.md` § Mobile → Pane detail still says the back
      control renders `LucideArrowLeft` + `back to the board` at 390px, and
      that the metadata strip "wraps beneath rather than truncating the
      title". At 390px the back control is now its icon with the string as
      its accessible name, and the strip is the third row with its
      diagnostics behind the overflow. The section needs the row budget and
      those two corrections.

## 6. Out of scope, recorded so it is not re-derived

- The 120-column PTY against a ~40-column fitted terminal. Separate lane,
  `apps/web/src/app/pane-detail/pane-terminal.ts`; see
  `tmp/foreman/INVESTIGATION-viewport-notifications.md`.
- The app header (64px, 10%) and the board's filter bar (256px, 39%). Not
  this change.
- No safe-area inset is consumed although `index.html` sets
  `viewport-fit=cover`. Untouched: the port never needed it, and the key bar
  is still the only surface that reads an inset.
- `.checkout-path` rendering 403px wide inside a 390px viewport **is** fixed,
  because the port moved it: under the overflow it takes its own line and
  wraps, and the page's horizontal overflow measures 0 in every state.
