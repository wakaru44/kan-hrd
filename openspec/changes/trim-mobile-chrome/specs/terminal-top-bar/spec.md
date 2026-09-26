## ADDED Requirements

### Requirement: The pane-detail header has a row budget on a phone

Below `--breakpoint-mobile` the pane-detail header SHALL render at most
**three** rows, and the terminal SHALL start within the first quarter of
the viewport height. At the reference width `docs/UX-GUIDELINES.md`
§ Mobile names (390 x 664), the header SHALL be no taller than **150px**
and the terminal container SHALL take at least **45%** of the viewport
height.

The three rows SHALL be:

1. **identity** — the back control first in focus order, the next-card
   control when the pane shares a tab, the pane title, the host seal, and
   the overflow trigger;
2. **navigator** — the current tab as a control that discloses the
   workspace's other tabs, and the cards of the current tab beside it;
3. **meta** — the pane's status and the `files` toggle.

Each of the first two SHALL be a single non-wrapping flex line, so a long
title or an added control shortens the title rather than breaking the
budget.

The back control SHALL render as its icon alone at this width; its
accessible name and its tooltip SHALL still be `copy.nav.backToBoard`, it
SHALL remain the header's first focusable element, it SHALL remain visible
without scrolling, and it SHALL remain a `--touch-target-min` target.

The workspace / tab breadcrumb, the checkout path, the pane id, the
revision, the last-poll elapsed, the stale marker and the rename control
SHALL be revealed by the identity row's overflow trigger — a visible
`LucideMoreHorizontal` control carrying `copy.nav.moreActions` and an
`aria-expanded` state. The rename control SHALL return to the title's
trailing edge when the overflow opens: the title and its control are never
split, only ever both present or both away. Nothing SHALL be reachable by
hover alone and nothing by a gesture alone.

At or above `--breakpoint-mobile` the header SHALL keep its shipped
layout. Every rule implementing this budget SHALL sit inside the mobile
media query, and any grouping element it needs SHALL be `display: contents`
outside that query, so the header's rendered children at desktop widths are
unchanged.

#### Scenario: Three rows on a phone

- **WHEN** pane detail renders at 390px for a pane that shares a tab in a
  multi-tab workspace
- **THEN** the header renders three rows, is no taller than 150px, and the
  terminal container's top is within the first quarter of the viewport
  height

#### Scenario: The folded rows are one tap away, never gone

- **WHEN** the operator activates the identity row's overflow trigger
- **THEN** the workspace name, checkout path, pane id, revision, last-poll
  elapsed and the rename control are shown, and the page still does not
  scroll horizontally

#### Scenario: Desktop is unchanged

- **WHEN** pane detail renders at or above `--breakpoint-mobile`
- **THEN** the header renders its shipped rows, the overflow trigger and the
  tab disclosure are not displayed, and the budget does not apply

### Requirement: The phone header steps aside while the terminal has focus

Below `--breakpoint-mobile`, while the operator is in the terminal — which
on a phone is when the soft keyboard has taken half the screen — the header
SHALL render the identity row alone and give the navigator and meta rows to
the terminal. It SHALL NOT collapse while the overflow or the tab
disclosure is open: the operator asked for those rows.

The collapse SHALL be reversible without hunting. A pointer press anywhere
in the header SHALL restore the rows, and the terminal losing focus SHALL
restore them too. A touch press on a part of the header that is not itself
a control SHALL prevent its own default, so the terminal keeps focus and
the soft keyboard is not dismissed; a mouse press SHALL be left alone, so
selecting header text with a cursor is unaffected. A pointer press in the
terminal SHALL collapse the header again, whether or not focus moved.

The back control SHALL remain visible, first in focus order and a
`--touch-target-min` target while collapsed. Focus moving within the
terminal box SHALL NOT restore the header.

#### Scenario: Typing gives the rows back

- **WHEN** the operator focuses the terminal at 390px
- **THEN** the header renders the identity row alone, no taller than 64px,
  and the terminal container grows by what the other two rows held

#### Scenario: One tap brings the header back, and the keyboard stays

- **WHEN** the operator taps the title while the terminal has focus
- **THEN** the navigator and meta rows return and the terminal still has
  focus

#### Scenario: An open control is not collapsed away

- **WHEN** the overflow is open and the operator focuses the terminal
- **THEN** the header does not collapse

## MODIFIED Requirements

### Requirement: The top bar is the pane detail header, not a second bar

Pane detail SHALL render exactly one header element. The breadcrumb and
the switcher SHALL be added to the existing header rather than to an
additional bar stacked above or below it.

The header SHALL keep the back control (`LucideArrowLeft` +
`copy.nav.backToBoard`) as its **first focusable element**, and that
control SHALL remain visible without scrolling at every supported
viewport width, per `docs/UX-GUIDELINES.md` § Mobile → Pane detail.

At or above `--breakpoint-mobile` the existing metadata strip (status,
pane id, revision, last-poll elapsed) SHALL keep its own row beneath the
title and SHALL NOT be moved into the switcher or the breadcrumb. Below
`--breakpoint-mobile` the strip SHALL be the header's third row carrying
status and the `files` toggle, with the checkout path, pane id, revision and
last-poll elapsed behind the identity row's overflow trigger — reachable, and
never merged into the switcher or the breadcrumb. When the overflow is open
the checkout path SHALL take its own line and wrap inside the strip; it SHALL
NOT widen the page.

The terminal SHALL keep the remaining height of the view. Adding the
breadcrumb and the switcher SHALL NOT cause the terminal container to
reach a zero height, and the terminal SHALL be refitted when the header's
height changes — the existing `ResizeObserver` on the terminal container
already observes that change and SHALL be relied on rather than
duplicated. Opening or closing the overflow changes the header's height
and SHALL refit the terminal through that same observer.

#### Scenario: One header

- **WHEN** pane detail renders for any pane
- **THEN** the view contains exactly one header element, whose first
  focusable child is the back control

#### Scenario: The terminal is refitted when the header grows

- **WHEN** the switcher appears (a second card joins the tab) and the
  header therefore becomes taller
- **THEN** the terminal refits to the reduced container height and its
  prompt remains visible and reachable

#### Scenario: The diagnostics are reachable on a phone

- **WHEN** pane detail renders below `--breakpoint-mobile` and the operator
  opens the identity row's overflow
- **THEN** the pane id, revision and last-poll elapsed are shown, and the
  terminal refits when the overflow closes

### Requirement: The top bar shows the card's host, workspace and tab

The top bar SHALL show the card's workspace name and tab name, rendered as
`workspace / tab` in `--ink-mute`, derived from the projected pane's
`workspace.name` and `tab.name`.

The host SHALL continue to be carried by the existing hanko seal already
in the header; the breadcrumb SHALL NOT repeat the host name.

Both names SHALL come from the pane already in `PanesStore`. No wire
method, schema field, capability flag or herdr call SHALL be added to
obtain them.

A name that is longer than its slot SHALL truncate with an ellipsis, and
truncating a name SHALL NOT truncate the card title.

Below `--breakpoint-mobile` the breadcrumb SHALL leave the header: the tab
name is the navigator row's own disclosure label there, so the breadcrumb
would only repeat it. Both names SHALL be shown, as `workspace / tab`, when
the identity row's overflow is open.

#### Scenario: Breadcrumb on the detail route

- **WHEN** the operator opens a card whose pane reports
  `workspace.name = "api"` and `tab.name = "build"`
- **THEN** the top bar shows `api / build` and the host seal shows the
  host name

#### Scenario: No new wire traffic for the breadcrumb

- **WHEN** pane detail renders its breadcrumb
- **THEN** no request beyond the existing `pane.read` /
  `pane.subscribe_output` pair is sent to the bridge

#### Scenario: At 390px

- **WHEN** the detail route renders at a 390px-wide viewport
- **THEN** the header carries no breadcrumb, the tab name is on the
  navigator row, and opening the overflow shows `workspace / tab`

### Requirement: The bar carries herdr's tab level above its pane level

The pane detail bar SHALL render the tabs of the route pane's workspace so
that the two levels the operator sees are the two levels herdr has: tabs,
then the panes of the selected tab. At or above `--breakpoint-mobile` the
tab level SHALL sit **above** the card switcher. Below
`--breakpoint-mobile` the two levels SHALL share one row: the current tab
as a control that discloses the workspace's other tabs, with the cards of
that tab beside it.

The tabs SHALL be derived client-side from `PanesStore.tabsSignal` as the
tabs whose `host` equals the route's host and whose `workspace.id` equals
the route pane's workspace id. No wire method, schema change, capability
flag or request SHALL be introduced for this derivation.

Each entry SHALL be a link to a pane detail route (`/pane/:host/:id`) of
that tab, so the URL remains the state and a shared link reproduces the
view. An entry SHALL NOT swap the terminal's contents without changing
the URL, and selecting the current tab SHALL be a no-op rather than a
reload. This holds at both widths: the disclosure changes what is on
screen, never what the route is.

The current tab SHALL be marked by text weight plus an `--ochre-line`
underline and by `aria-current="page"`, never by a colour fill alone.

When the workspace holds exactly one tab the strip SHALL NOT be rendered:
no empty strip, no disabled control, no placeholder. Below
`--breakpoint-mobile` the tab control SHALL likewise not be rendered, and
the navigator row SHALL carry the card switcher alone.

The strip SHALL be operable by keyboard on its own — a roving tabindex,
arrow keys and Home/End — and SHALL NOT take a key the terminal needs.
Entries that do not fit SHALL scroll inside the strip's own container;
the page SHALL NOT scroll horizontally at any width.

The pane level SHALL read as subordinate to the tab level through type
scale and indentation rather than through a second kind of chrome. Below
`--breakpoint-mobile`, where the two share a row, the tab control SHALL
read as the row's anchor through its own boundary rather than through a
second kind of chrome.

#### Scenario: Both levels are visible from a terminal

- **WHEN** the operator opens a pane in a workspace with four tabs, in a tab holding two panes
- **THEN** the bar shows the four tabs with the current one marked, and beneath them the two panes with the current one marked

#### Scenario: Both levels on one row at phone width

- **WHEN** the same pane is opened below `--breakpoint-mobile`
- **THEN** the navigator row shows the current tab as a disclosure control
  and the tab's two panes beside it, with the current one marked

#### Scenario: A tab entry navigates by URL

- **WHEN** the operator selects another tab in the strip
- **THEN** the route becomes that tab's pane detail URL, and no pane content is swapped without the URL changing

#### Scenario: One tab, no strip

- **WHEN** the route pane's workspace holds exactly one tab
- **THEN** no tab strip and no tab disclosure control is rendered, and the card switcher below or beside it is unaffected

#### Scenario: The strip asks the bridge for nothing

- **WHEN** the tab strip renders with any number of tabs
- **THEN** no wire method is called for the tabs, which are derived from the store the board already fills
