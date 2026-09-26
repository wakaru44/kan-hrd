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

The bridge cannot fix this itself, and must not. ADR-0003 built it to hold no
credentials and ADR-0006 rejected option C on that ground: no key path, no
agent socket, no `known_hosts` policy, no spawned `ssh`. Whatever reads a
remote file has to be reached the way herdr is reached — over a socket the
operator's own tunnel process lands on the bridge's machine.

That is the whole shape of this change. `kanhrd tunnel up`
(`add-tunnel-command`) already holds the credentials and already has an ssh
session open to the host. The same session carries a second forward, to a
small read-only kanhrd reader running on the far machine. The bridge connects
to a socket path from its config and speaks the four file methods it already
implements. It resolves nothing, spawns nothing and holds nothing.

Confinement is the reason the far side must do the reading rather than the
bridge doing it over some remote-filesystem trick: a remote checkout's
symlinks resolve on the remote machine. Only a process there can tell whether
`link/secret.txt` stays inside the pane's directory.

## What Changes

- **A remote host's files come from a kanhrd reader on that host.** The
  bridge calls it over a forwarded Unix socket with newline-delimited JSON,
  in the same request/response shapes the SPA already reads. No field
  mapping, no second vocabulary.
- **The reader is the shipped reader.** `RepoFileReader`, `confine.ts` and
  `git.ts` run unchanged behind a `kanhrd files serve` subcommand; the remote
  and local paths are one implementation with two transports.
- **The tunnel starts it and stops it.** `kanhrd tunnel up` raises the file
  forward beside the herdr forward on the same ssh session, so the two share
  one lifecycle and one failure mode.
- **The local path is unchanged.** A host the operator declares local keeps
  `RepoFileReader`, `node:fs` and a local `git`, in-process, byte for byte.
- **Which source a host uses is configured, never guessed.** Per host:
  `files: false` refuses everything; a host with a reader socket is served by
  that reader; a host declared local is served in-process. A host that is
  neither answers `files_unsupported`, naming what is missing.
- **The local-only gate is deleted, not widened.** `files_not_local`, the
  stat-based machine guess and `gate.ts` go away. The bridge SHALL NOT
  resolve a remote pane's `cwd` or `checkout_path` against its own
  filesystem, and a test asserts it.
- **The root is the pane's `cwd`, not the checkout.** Clearer, and it matches
  what the agent is working in. Listing and reading need only a `cwd`, so a
  pane outside any repository can be browsed at all.
- **Git views become an advertised extra.** `repo.status` and `repo.diff`
  still need a checkout; the pane advertises whether it has one and the SPA
  shows the git views only then. `files_local` is replaced by two honest
  flags rather than one flag that means three things.

## Impact

- **Changed**: `apps/bridge/src/files/` — a `PaneFiles` source chosen per
  host, with the shipped reader behind it and a socket-speaking
  implementation beside it; `gate.ts` and `gate.test.ts` deleted, along with
  `filesLocalHint` and the `files_not_local` path.
- **New**: `kanhrd files serve` — the reader over a Unix socket, in the CLI
  package `add-tunnel-command` introduces; installed on every host whose
  panes should be readable.
- **Wire**: `Pane.project.files_local` is replaced by `files_available` and
  `git_available` in `packages/schema`; the SPA's file panel reads the new
  flags. Bridge and SPA ship together, so this is an internal rename with no
  compatibility window.
- **Specs**: `repo-file-reads` — the machine requirement is rewritten, and
  confinement and rooting move from the checkout to the `cwd`.
- **Depends on**: `add-tunnel-command` for the ssh session the file forward
  rides on, and for the `kanhrd` CLI the reader is a subcommand of. That
  change's tunnel gains a second `-L` and a remote command; nothing else in
  it moves.
- **Not in scope**: writing, any editor affordance, watching for changes, any
  bridge-held credential or bridge-spawned `ssh`, and any request to herdr's
  maintainers. herdr's API is not part of this change.

## Alternatives considered

- **The bridge holds an SSH connection and reads over SFTP plus
  `ssh -- git`.** Rejected: key material or `SSH_AUTH_SOCK` inside the
  bridge, which ADR-0003 forbids and ADR-0006 rejected as option C.
- **Per-request `ssh <target> <command>` from the operator-side tunnel
  process.** Rejected on the numbers ADR-0006 measured: ~200ms per request
  bare, ~30ms over `ControlMaster`, against a status poll that runs while a
  panel is open. It also makes confinement a matter of quoting a shell
  command correctly, which is the wrong place to be careful.
- **Mount the remote filesystem (sshfs/rclone) beside the bridge.** FUSE in
  the container needs `/dev/fuse` and `SYS_ADMIN`, a dropped link hangs every
  read uninterruptibly rather than failing one request, symlinks resolve on
  the wrong side of the mount, and it puts an operator-managed mount back in
  the path.
- **Read the files through a herdr pane** — send keystrokes, scrape output.
  Rejected: it races the agent for its own terminal, and there is no framing
  that tells a file's bytes from a program's output.
- **Ask herdr for file-read methods on its own socket.** Rejected: it makes
  kanhrd's feature wait on another project's release cycle, and herdr's API
  does not grow for the board's sake. The reader kanhrd already has runs on
  the far machine instead.
- **Keep the checkout as the root and leave `cwd`-only panes unreadable.**
  Less code, but it makes the panel absent exactly when an agent is working
  in a scratch directory, which is a case the board sees.
