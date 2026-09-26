## Why

The operator moved a card with `move to…` → `a new workspace`, decided it
was the wrong choice, and could not put it back: "i have no means of
putting it back."

The menu offers three destinations, and after that move none of them
leads home:

| item | destination sent | after a `new workspace` move |
| --- | --- | --- |
| `another tab` | `{type:'tab', tab_id, split:'right'}` | only helps if the old **tab** still exists — herdr closes a tab when its last pane leaves |
| `a new tab` | `{type:'new_tab'}` | a new tab in the pane's **current** workspace, which is the wrong one |
| `a new workspace` | `{type:'new_workspace'}` | a third workspace |

`{type:'new_tab'}` with no `workspace_id` resolves to
`previous_workspace_id` — the workspace the pane is already in
(herdr `src/app/api/panes.rs:1086-1105`). So the pane that left a
workspace alone has no item that names the workspace it came from, and
once its old tab closed behind it there is nothing on the board that
points back.

`another tab` was never broken: it lists every tab of every workspace the
board knows about, labelled `workspace / tab`, the pane's own tab
excluded. It only stops covering the way back when the tab it came from
no longer exists — which is exactly what a last-pane move causes.

## What Changes

One new item in the card's move menu, in both the inline `move` menu and
the overflow menu's `move to…` group:

- **`another workspace`** — expands the existing `DestinationPicker` at
  **workspace** level and sends
  `{type:'new_tab', workspace_id:'<chosen>'}`.

herdr has no "move into an existing workspace" primitive. A tab is the
only container a pane can be put in, so landing in a workspace without
naming one of its tabs means a new tab in that workspace, and the copy
promises no more than "another workspace" — a workspace is what the
operator chooses.

The pane's own workspace is left out of that list, for the same reason
its own tab is left out of `another tab`: choosing it is
`{type:'new_tab'}` again, an item the menu already carries one line
below.

Nothing else moves. `new_tab`'s optional `workspace_id` is already in
`packages/schema/src/herdr.ts` (it mirrors herdr's
`PaneMoveDestination::NewTab`), and the bridge forwards `destination`
verbatim (`apps/bridge/src/herdr/hosts.ts:332-364`), so neither the wire
nor the bridge changes.

## Impact

- **Affected specs:** `board-card-actions` — one MODIFIED requirement
  (*A pane can be moved to another tab or workspace*): four destinations
  instead of three, and the rule that a destination which duplicates
  another item is not offered.
- **Affected code:** `apps/web/src/app/board/card.{ts,html}`,
  `apps/web/src/app/shared/destination-picker.{ts,html}`,
  `apps/web/src/app/shared/copy.ts` (one new string).
- **Affected docs (a maintainer owns these, not this lane):**
  `docs/BRAND.md`'s approved-copy table has no row for
  `card.moveExistingWorkspace`, and `docs/UX-GUIDELINES.md` line 157 says
  the move menu's items are "another tab, a new tab, a new workspace".
  Both need the fourth item.
- **No change to:** the bridge, the wire schema, `pane.move`'s result
  handling, parking, or the menu's keyboard contract.
