## Why

`alpaca01` runs herdr and cannot be put on the board. ADR-0006 settled the
transport: a remote host is a socket file on the bridge's machine, landed
there by `ssh -L`, and the bridge connects to it like any local host. That
decision costs zero bridge code — and it is exactly why nothing ships. The
operator is left to hand-build the forward, keep it alive, and rebuild it
after every drop, from a recipe `docs/OPERATING.md` does not yet contain
(ADR-0006 defect #4: §3 documents only the reverse direction).

So the missing half is ergonomics, not transport. kanhrd already knows which
hosts are remote and what socket path each one needs — that is what
`kanhrd.config.yaml` is. A command that reads that config and runs the
forwards is a small, honest piece of software; it is the difference between
a decision and a feature.

It must not live in the bridge. ADR-0003 built the bridge to own no
credentials, and an `ssh` child inside it would need agent access, key paths
and `known_hosts` policy — ADR-0006's rejected option C. The tunnel runs in
the operator's own session, beside their agent, where their credentials
already are.

## What Changes

- **A new `kanhrd` CLI with three subcommands.** `kanhrd tunnel up` brings a
  forward up, `kanhrd tunnel down` takes it down, `kanhrd tunnel status`
  says, per host, whether the forward is up and what went wrong if not.
- **`kanhrd tunnel up --all` reads the bridge config** and brings up one
  forward per configured remote host. The config file is the supervision
  model: there is no second inventory of hosts to keep in sync.
- **`HostConfig` may grow what the tunnel needs to know** — an ssh target and
  the remote socket path. The bridge keeps ignoring those fields: it still
  reads `socket` and calls `connect()`. No bridge behaviour changes.
- **The native `ssh` binary does the work.** Keys, `~/.ssh/config`,
  `known_hosts`, `ProxyJump` and the agent belong to the user's ssh client.
  The command builds argv and supervises a process; it parses no ssh config
  and verifies no host key.
- **`-o StreamLocalBindUnlink=yes` always**, because a dead tunnel leaves the
  socket file behind and a restart over it fails with "Address already in
  use" (measured in ADR-0006). `BatchMode=yes` always, so nothing can prompt.
- **`status` tells the failure modes apart** — no socket file, socket file
  but no listener (tunnel dead), tunnel up but wrong remote path — which is
  the ADR-0006 consequence that currently reads as one generic grey host.
- **Docs are part of the feature**, not a follow-up: the forward-direction
  recipe, a how-to, the Docker case, linked from both the quickstart and the
  user guide.

## Impact

- **New**: a `kanhrd` CLI entry point with a `tunnel` command group, and
  `openspec/specs/tunnel-command/`.
- **Changed**: `apps/bridge/src/config.ts` — optional per-host fields the
  tunnel command reads (snake_case in the file, like every other key); the
  bridge's own use of `HostConfig` is untouched.
- **Docs**: `docs/OPERATING.md` forward-direction recipe, a how-to,
  `docs/CONTEXT.md` vocabulary, the Docker `~/.ssh` + `SSH_AUTH_SOCK` case,
  and links from the quickstart and the full user guide.
- **Unchanged**: the bridge process, its wire contract, its failure
  vocabulary, and its credential posture (ADR-0003: it holds none).

## Non-goals

- **Remote file reads.** Out of scope here and owned by another lane; the
  decision is that herdr grows file-read methods upstream rather than kanhrd
  reaching over a side channel. The tunnel command exposes no exec path for
  anything to build on.
- **Any bridge-side ssh ownership.** The bridge SHALL NOT spawn, supervise or
  configure `ssh`. That is ADR-0006 option C, rejected on credential posture.
- **Reimplementing ssh.** No config parsing, no key handling, no host-key
  policy, no in-process SSH library.
- **The reverse direction.** `docs/OPERATING.md` §3's laptop-pushes-up
  recipe stands as it is; this adds the forward mirror, it does not replace
  it.
