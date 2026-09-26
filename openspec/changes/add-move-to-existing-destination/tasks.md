# Tasks — add-move-to-existing-destination

## 1. Confirm what herdr and the wire already allow

- [x] 1.1 Read `PaneMoveDestination` in the herdr checkout
      (`src/api/schema/panes.rs:93-114`) and its resolution
      (`src/app/api/panes.rs:1086-1105`): `new_tab` without
      `workspace_id` resolves to the pane's current workspace.
- [x] 1.2 Confirm `packages/schema/src/herdr.ts` already carries
      `{type:'new_tab'; workspace_id?: string}` — no wire change.
- [x] 1.3 Confirm the bridge forwards `destination` verbatim
      (`apps/bridge/src/herdr/hosts.ts:332-364`) — no bridge change.
- [x] 1.4 Record what `another tab` shows today: every tab of every
      workspace the board knows, labelled `workspace / tab`, own tab
      excluded. No second tab list is added.

## 2. The destination list learns to leave a workspace out

- [x] 2.1 `DestinationQuery.excludeWorkspace`, applied at `workspace`
      level only — a sibling of `excludeTab`, same shape.
- [x] 2.2 `DestinationPicker.excludeWorkspace` input, passed through.

## 3. The card's move menu

- [x] 3.1 `copy.card.moveExistingWorkspace = 'another workspace'`.
- [x] 3.2 `moveToWorkspace(destination)` sends
      `{type:'new_tab', workspace_id}`.
- [x] 3.3 The item, expanding the picker in place, in BOTH the inline
      move menu and the overflow menu's `move to…` group.
- [x] 3.4 The focus effect and both menu-reset paths account for the new
      expansion state, so the keyboard contract is unchanged.

## 4. Tests

- [x] 4.1 `destinationsFor` leaves out the excluded workspace, and leaves
      the tab list untouched.
- [x] 4.2 The card sends `{type:'new_tab', workspace_id: <chosen>}` — the
      params asserted, not just the call.
- [x] 4.3 The menu lists four items, in both surfaces.
- [x] 4.4 `pnpm --filter @kanhrd/web test`, `pnpm --filter @kanhrd/web
      build`, `pre-commit run --files …`,
      `openspec validate add-move-to-existing-destination --strict`.
