## Why

`repo-file-reads` serves files only from the bridge's own machine. The gate
(`apps/bridge/src/files/gate.ts:57`) stats the pane's `cwd` and
`checkout_path` on the bridge's filesystem and refuses otherwise, and its own
comment says why it must: *"What it cannot do is prove machine identity: a
tunnelled host whose paths also exist here as the same checkout passes. That
is what `files: false` on the host is for."*

So a pane on a remote host — the case the board exists for, an agent working
somewhere else — can be watched but its output cannot be read. The operator
falls back to a terminal beside the board.

Two things change that. `add-ssh-host-transport` makes the transport
explicit, so the bridge no longer has to guess which machine a path belongs
to: it knows, from config, and it holds a connection that can run a command
there. And the guessing gate can then be deleted rather than extended — the
heuristic exists only because the transport was implicit.

The panel is for reading what an agent produced, not editing it. Nothing here
writes.

## What Changes

- **A host's filesystem is chosen by its transport.** A seam behind
  `RepoFileReader`: local hosts keep `node:fs` and a local `git`; ssh hosts
  read over the same connection the RPC uses — `sftp` for listing and
  reading, `ssh -S <control> -- git …` for status and diff. Both are
  read-only; the existing `diff-index` rule travels with the commands.
- **The local-only gate is removed, not widened.** `files_not_local` and the
  stat-based machine guess go away. What remains is the operator's switch
  (`files: false`), the host being connected, and path confinement.
- **The root is the pane's `cwd`, not the checkout.** Clearer, and it matches
  what the agent is working in. `repo.tree` and `file.read` need only a
  `cwd`, so a pane outside any repository can now be browsed at all.
- **Git views become an advertised extra.** `repo.status` and `repo.diff`
  still need a checkout; the pane advertises whether it has one, and the SPA
  shows the git views only then. `files_local` is replaced by two honest
  flags rather than one flag that means three things.
- **Remote reads are bounded.** One SFTP session per host, requests queued,
  the existing size caps unchanged, and a per-request timeout so a slow link
  fails a read instead of hanging a socket.

## Impact

- **Changed**: `apps/bridge/src/files/reader.ts` (splits behind the
  filesystem seam), `git.ts` (runner becomes local-or-remote), `gate.ts`
  (deleted, with `filesLocalHint` and its tests), `apps/bridge/src/herdr/hosts.ts`
  (`localCheckout` becomes a transport-aware root resolution).
- **Wire**: `Pane.project.files_local` is replaced by `files_available` and
  `git_available` in `packages/schema`; the SPA's file panel reads the new
  flags. Bridge and SPA ship together, so this is an internal rename with no
  compatibility window.
- **Specs**: `repo-file-reads` — the machine requirement is rewritten, and
  confinement and rooting move from the checkout to the `cwd`.
- **Depends on**: `add-ssh-host-transport`. Without the transport's control
  socket there is nothing to read over, so this change does not start until
  that one's supervisor lands.
- **Not in scope**: writing, any editor affordance, and watching for changes.
  Reads are on demand, as the panel already does them.

## Alternatives considered

- **Mount the remote filesystem (sshfs/rclone) beside the bridge.** Then no
  bridge change at all. Rejected: FUSE in the container needs `/dev/fuse` and
  `SYS_ADMIN`, a dropped link hangs every read in uninterruptible state
  rather than failing one request, and it puts an operator-managed mount back
  in the path — the burden `add-ssh-host-transport` exists to remove.
- **Keep the checkout as the root and leave `cwd`-only panes unreadable.**
  Less code, but it makes the panel absent exactly when an agent is working
  in a scratch directory, which is a case the board sees.
- **A second SSH connection for files.** A second authentication and a second
  thing to supervise, for no gain over the control socket.
