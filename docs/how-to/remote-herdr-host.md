# How to put a remote herdr host on the board

Take a machine you can already `ssh` into, running herdr, and make its
panes cards on your board. The bridge never speaks SSH: you land that
machine's herdr socket on the bridge's machine as a file, and the bridge
connects to it like any local host. See
[ADR-0006](../adr/0006-remote-herdr-hosts.md) for why the transport is
shaped this way.

## Prerequisites

- A bridge already running on your own machine against your local herdr —
  the getting-started path in the repo [`README.md`](../../README.md).
- `ssh` access to the remote machine, under an alias your `~/.ssh/config`
  resolves. A host alias and a machine's hostname are not the same thing;
  use the alias you actually connect with, and confirm it with
  `ssh <alias> true` before going further.
- herdr running on that machine, with its socket path known. It is
  `~/.config/herdr/herdr.sock` under that machine's own user unless
  `$XDG_CONFIG_HOME` moves it. `ssh <alias> 'ls -l ~/.config/herdr/herdr.sock'`
  prints the absolute path you will need.
- A directory on your machine to keep forwarded sockets in:

  ```bash
  mkdir -p ~/.kanhrd
  ```

## Raise the tunnel

### By hand

One `ssh` per remote host, from your machine:

```bash
ssh -f -N -o ExitOnForwardFailure=yes -o StreamLocalBindUnlink=yes \
  -L ~/.kanhrd/alpaca01.sock:/home/you/.config/herdr/herdr.sock alpaca01
```

Read the `-L` argument as `<local socket>:<remote socket>`. Both ends are
socket **paths**, not ports — this is the part `-L` makes easy to get
wrong, and a port on the left silently gives you a forward the bridge can
never connect to. The remote path must be absolute: `~` is not expanded on
the far side.

The rest, each earning its place:

- `-f -N` — no remote command, background after authenticating. The tunnel
  is the whole job.
- `-o ExitOnForwardFailure=yes` — a forward that cannot be established
  fails the command instead of leaving you a connection with no tunnel on
  it. Without this the failure is silent and only shows up later as a grey
  host on the board.
- `-o StreamLocalBindUnlink=yes` — removes a stale socket file left behind
  by a dropped tunnel. The file outlives the process, so without this the
  second run fails to bind with `Address already in use`.

The tunnel lives in your session, not in the bridge; nothing supervises it.
When it drops, bring it up again with the same command.

## Add the host to the config

The bridge reads `kanhrd.config.yaml` from its working directory —
the repo root, if you start it with `make run` — unless `--config <path>`
says otherwise. Copy [`kanhrd.config.example.yaml`](../../kanhrd.config.example.yaml)
if you have no file yet, then name the forwarded socket:

```yaml
hosts:
  - name: local
    socket: ~/.config/herdr/herdr.sock

  - name: alpaca01
    socket: ~/.kanhrd/alpaca01.sock
```

The keys are `name` and `socket`; `~` is expanded to your home directory.
Nothing in the entry says the host is remote, and nothing needs to — from
the bridge's side it is a socket path.

Restart the bridge to pick the file up.

### The origin check tightens when the file appears

If you were running with no config file, or with one the bridge could not
read, you had the defaults: `bind: 127.0.0.1`, `port: 5173`, and an origin
allowlist derived from those. A real config file replaces that derivation
with your own values, so an origin that worked before — a Tailscale HTTPS
name in front of the bridge, a reverse proxy — now has to be named:

```yaml
allowed_origins:
  - https://laptop.tailnet-name.ts.net
```

Miss this and the page loads but every `/ws` handshake is refused with
`403 origin not allowed`; the bridge's log names the origin it rejected
and the allowlist it compared against.

## Verify

Ask the bridge, rather than the board:

```bash
curl -s http://127.0.0.1:5173/api/hosts
```

Connected looks like this:

```json
{
  "hosts": [
    { "name": "local", "connected": true },
    { "name": "alpaca01", "connected": true }
  ]
}
```

Then open the board: `alpaca01`'s panes are cards, with a host chip you can
filter by.

## Troubleshooting

A host that will not connect reports `connected: false` and a
`last_error`, and the three ways this goes wrong are told apart by that
string:

- **`connect ENOENT <path>`** — no socket file at all. The tunnel was never
  raised, or the local path in `-L` is not the path in `socket:`.
- **`connect ECONNREFUSED <path>`** — the socket file is there but nothing
  is listening. The tunnel died and left its file behind. Raise it again;
  `StreamLocalBindUnlink=yes` clears the stale file for you.
- **`EPIPE`, or a response that never arrives** — the tunnel is up and the
  remote path is wrong. The local `connect()` succeeds, then the channel
  dies when `ssh` fails to reach the far socket. Check the remote path with
  `ssh <alias> 'ls -l <path>'`.

Other things that bite:

- **`unix_listener: cannot bind to path …: Address already in use`** when
  raising the tunnel. A stale socket file from a dropped tunnel; you left
  `StreamLocalBindUnlink=yes` off.
- **The right alias, the wrong machine.** An old alias in `~/.ssh/config`
  can point at a different host or a different key than the name suggests.
  `ssh -G <alias>` prints the resolved `hostname`, `user` and `identityfile`.
- **The file panel on a remote pane says the files are elsewhere.** Opening
  a card from a tunnelled host shows "these files are on another machine."
  That pane's checkout is on the far machine and the bridge reads checkouts
  on its own filesystem only, so it refuses rather than reading a lookalike
  path. Expected today; the `add-remote-file-reads` change is where that
  gets solved.
- **Two machines with the same directory layout.** If a tunnelled host's
  paths also exist on the bridge's machine, the bridge cannot tell the two
  apart and may read the wrong checkout. Turn files off for that host:

  ```yaml
  - name: alpaca01
    socket: ~/.kanhrd/alpaca01.sock
    files: false
  ```

## Related

- [`docs/OPERATING.md`](../OPERATING.md) §5 — where this recipe sits among
  the deployment shapes, and §3 for the reverse direction (a laptop pushing
  its socket up to an always-on hub).
- [ADR-0006](../adr/0006-remote-herdr-hosts.md) — why remote hosts are an
  operator-managed forward and not something the bridge opens itself.
- [ADR-0001](../adr/0001-hub-bridge-ssh-tunnels.md) — the hub-bridge
  topology this rests on.
