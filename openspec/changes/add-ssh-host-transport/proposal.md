## Why

A herdr host that is not the bridge's own machine has no supported way in.
`HostConfig` is `{ name, socket, files? }` (`apps/bridge/src/config.ts:6`) and
`HerdrClient` opens that path with `createConnection`
(`apps/bridge/src/herdr/client.ts:113`), so "remote host" today means the
operator hand-built an `ssh -L` tunnel to a socket path before starting the
bridge, kept it alive themselves, and rebuilt it after every drop. Nothing in
kanhrd knows the host is remote, which is why `files: false` exists as a
manual switch and why the file gate has to guess machine identity by stat-ing
paths (`apps/bridge/src/files/gate.ts:57`).

herdr's whole API is one unix socket of newline-delimited JSON, so an SSH
connection is sufficient to drive a remote herdr completely: OpenSSH forwards
a unix socket to a unix socket (`-L /local.sock:/remote.sock`, 6.7+), and the
same connection can run commands on the far side. One transport therefore
carries the RPC the bridge already speaks, and later the file reads it cannot
serve at all.

Owning that connection is the point: the operator names a host from their own
`~/.ssh/config` and the bridge does the rest — connect, authenticate through
their agent, keep alive, reconnect with backoff, and say plainly when it
cannot. No tunnel to babysit.

## What Changes

- **A host declares a transport.** `HostConfig` grows an optional `ssh`
  block. With it, `socket` is a path on the REMOTE machine; without it,
  nothing changes and the host is local exactly as today.
- **The bridge drives the user's own `ssh`.** It spawns OpenSSH as a
  supervised child with `ControlMaster`, forwarding the remote herdr socket
  to a private local socket, and hands that path to the unchanged
  `HerdrClient`. The user's `~/.ssh/config` (or an `-F` file they name),
  their agent, their `known_hosts`, their `ProxyJump` all apply because the
  real client reads them — kanhrd reimplements none of it.
- **The control socket is the seam later work reuses.** Once the master is
  up, `ssh -S <control> <target> -- <cmd>` runs on the far side with no
  second handshake. `add-remote-file-reads` is built on this and on nothing
  else.
- **Failures are states, not crashes.** A refused key, an unknown host key,
  a dropped link and a missing `ssh` binary each become a host state with a
  reason the SPA can show, and the supervisor retries with backoff.
- **kanhrd never holds a secret.** `BatchMode=yes` always: no password
  prompt, no passphrase, no key material read by the bridge. Keys come from
  the agent. `StrictHostKeyChecking` is never relaxed.
- **A new capability, `ssh-host-transport`,** owns all of this. It is not an
  appendix to the herdr client: it is how a host is reached, and it has its
  own security posture, lifecycle and failure vocabulary.

## Impact

- **New**: `apps/bridge/src/ssh/` — argv builder, control-socket paths,
  connection supervisor.
- **Changed**: `apps/bridge/src/config.ts` (schema + remote-path handling:
  `~` in a remote `socket` must NOT be expanded against the bridge's own
  `$HOME`), `apps/bridge/src/herdr/hosts.ts` (`HostRuntime` starts the
  transport before the client, and reports its state), host state copy in the
  SPA.
- **Specs**: new `openspec/specs/ssh-host-transport/`. `bridge-security`
  gains the posture requirements for outbound SSH.
- **Ops**: the Docker image needs `openssh-client`, plus a mounted
  `~/.ssh` and `SSH_AUTH_SOCK`; `docs/OPERATING.md` and a new
  `docs/how-to/ssh-hosts.md` cover laptop and container cases.
- **Not in scope**: file reads over the transport (`add-remote-file-reads`,
  which depends on this), and any write path — herdr RPC is unchanged and
  still goes over the forwarded socket.

## Alternatives considered

- **An in-process SSH client (`ssh2`).** It can open a
  `direct-streamlocal@openssh.com` channel straight to the remote socket, so
  no forwarded socket file and no child process. Rejected as the default: it
  means reimplementing `~/.ssh/config` parsing, `Match`/`Include`,
  `ProxyJump` chaining and `known_hosts` verification in our own code — a
  security-relevant reimplementation of the client the user already trusts,
  and one that drifts from it. Worth revisiting only if the child process
  proves unworkable in the container.
- **Leaving the tunnel to the operator** (status quo, documented). It is the
  burden this change exists to remove, and it leaves the bridge unable to
  tell local from remote, which is what blocks remote file reads.
- **`ssh -W` / TCP.** herdr listens on a unix socket, not a port; a TCP hop
  would need something extra listening on the far side.
