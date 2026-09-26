# Design — add-move-to-existing-destination

## What herdr can express

`pane.move`'s destination union (`src/api/schema/panes.rs:93-114`), and
the installed CLI's usage, offer three shapes:

```
herdr pane move <pane_id> --tab <tab_id> --split right|down [--target-pane ID] [--ratio F]
herdr pane move <pane_id> --new-tab [--workspace ID] [--label TEXT]
herdr pane move <pane_id> --new-workspace [--label TEXT] [--tab-label TEXT]
```

A pane lives in a tab; a workspace is not a container a pane can sit in
directly. So "move into workspace W" has exactly two expressions:

1. `{type:'tab', tab_id}` where `tab_id` is one of W's tabs — already the
   board's `another tab`, and it requires the operator to pick a tab;
2. `{type:'new_tab', workspace_id: W}` — a tab is created in W for the
   pane.

There is no third. `new_workspace` always creates one, and `new_tab`
without `workspace_id` resolves to `previous_workspace_id`
(`src/app/api/panes.rs:1090-1105`), i.e. where the pane already is.

This change adds (2), which is the only one that works when W's tabs are
not what the operator wants to name — including the case where the tab
they came from was closed behind them.

## Why the picker, not a second list

`DestinationPicker` already renders a `role="group"` of plain
`role="menuitem"` buttons **inside** the menu that opened it, reads its
rows off `PanesStore` (so a workspace that closes while the menu is open
stops being offered), and labels rows with names rather than product
copy. It already supports `level: 'workspace'` — the `+` menu uses it.
The only thing it lacked was a way to leave one workspace out, which is
the same shape `excludeTab` already has for tabs.

## Why the pane's own workspace is excluded

`{type:'new_tab', workspace_id: <the pane's own>}` and
`{type:'new_tab'}` are the same request. The menu already carries the
second as `a new tab`, one line below. Offering the first as well is two
items with one outcome — and `another workspace` reads as a promise that
it is another one.

## Alternatives rejected

- **A tab picker grouped by workspace, with a "here" row per group.**
  One list, two meanings (a tab, or a workspace) behind rows that look
  alike. `another tab` and `another workspace` are two questions and
  two herdr destinations.
- **Reading the pane's previous workspace from `pane.move`'s result and
  offering "undo".** A single-step undo is state the board would have to
  hold, invalidate when the workspace closes, and explain when it
  expires. Naming the destination needs no memory and covers every move,
  not just the last one.
- **`workspace.list` to include workspaces with no panes.** Tier-3 has no
  browser-facing `workspace.list`; the board derives workspaces from
  `pane.list` and keeps them warm from lifecycle events. An empty
  workspace is not on the board, and is not a destination the operator
  can see they have.

## Copy

`docs/BRAND.md`'s approved-copy table has no phrase for this. The one
used is **`another workspace`**, the sibling of the table's existing
`another tab` / `a new tab` / `a new workspace` — lowercase, terse, no
care verb (a move is not a lifecycle event on a session). A maintainer
owns the table row.
