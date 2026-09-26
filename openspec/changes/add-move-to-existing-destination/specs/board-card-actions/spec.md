## MODIFIED Requirements

### Requirement: A pane can be moved to another tab or workspace

Where `BridgeCapabilities.paneMove` is true, the SPA SHALL offer moving a
pane to four destinations, each one a member of herdr's
`PaneMoveDestination` union:

| item | destination sent |
| --- | --- |
| an existing tab | `{type:'tab', tab_id, split:'right'}` |
| an existing workspace | `{type:'new_tab', workspace_id}` |
| a new tab | `{type:'new_tab'}` |
| a new workspace | `{type:'new_workspace'}` |

A pane lives in a tab, so an existing workspace SHALL be expressed as a
new tab in that workspace, and the copy SHALL promise no more than the
workspace the operator chose. Where `paneMove` is false, the SPA SHALL
NOT render the action at all — not disabled, not hidden behind a
failure.

The existing-tab and existing-workspace lists SHALL both be the one
destination list the board already uses, rendered as a group of menu
items inside the menu that opened it, read off the store so a
destination that stops existing while the menu is open stops being
offered.

A destination whose request another item in the same menu already sends
SHALL NOT be offered: the pane's own tab is left out of the tab list
(herdr's `same_tab` no-op), and the pane's own workspace is left out of
the workspace list (`{type:'new_tab', workspace_id: <own>}` is
`{type:'new_tab'}`, which the menu carries as `a new tab`).

A move's result SHALL be applied in full, including its cascade: moving the
last pane out of a tab closes that tab, and possibly its workspace. The SPA
SHALL reuse the local purge it already performs for `tab.closed` and
`workspace.closed` rather than implementing a second reconciliation.

A result of `changed: false` SHALL be reported to the operator with
herdr's own reason (`same_tab`, `zoomed_tab`), and SHALL NOT be presented
as a completed move. A failed move SHALL post a toast quoting herdr's
message, as every other lifecycle failure does.

Moving a pane SHALL NOT change its `agent_status`, and SHALL NOT be
offered as a way to change it.

#### Scenario: A pane moved into a new workspace has a way back

- **WHEN** the operator has moved the only pane of a tab into a new workspace, closing the tab behind it, and then opens that card's move menu
- **THEN** `another workspace` lists the workspace it came from, and choosing it sends `{type:'new_tab', workspace_id: <that workspace>}`, putting the card back in that workspace without leaving the board

#### Scenario: The list never names where the pane already is

- **WHEN** the operator opens `another tab` and `another workspace` for a card
- **THEN** the pane's own tab is absent from the first and the pane's own workspace is absent from the second

#### Scenario: Moving the last pane out of a tab

- **WHEN** the operator moves the only pane of a tab into another workspace and herdr returns `closed_tab_id`
- **THEN** the card appears under its new workspace, the emptied tab disappears from the rail, and no stale tab row is left behind

#### Scenario: A move that herdr refused

- **WHEN** `pane.move` returns `changed: false` with `reason: "zoomed_tab"`
- **THEN** the operator is told the move did not happen and why, and the card stays where it was

#### Scenario: No move affordance without the capability

- **WHEN** a card's host reports `paneMove: false`
- **THEN** that card offers no move control in any menu
