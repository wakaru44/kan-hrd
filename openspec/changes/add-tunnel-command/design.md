# Design — kanhrd tunnel

## Where the process lives

In the operator's session. Not in the bridge.

ADR-0006 measured both halves of this and chose option A: an `ssh -L`
unix→unix forward, 0.83ms median per request, surviving herdr's
close-per-request pattern and carrying a concurrent `events.subscribe` on the
same tunnel. Option C — the bridge spawning and supervising `ssh` — was
rejected: it moves `SSH_AUTH_SOCK`, key paths and `known_hosts` policy into
the one process ADR-0003 built to hold no credentials. A compromised bridge
today reaches the sockets it was given; with the keys it would reach anything
those keys open.

What was missing from A was never the transport. It was that the operator had
to hand-write the forward and babysit it. So kanhrd ships the ergonomics
without moving the credentials: the same `ssh -L` A describes, run from the
operator's shell by a command that already knows the hosts.

```
operator session                          bridge process
  kanhrd tunnel up --all                    HerdrClient
    └─ ssh -L <local.sock>:<remote.sock>      └─ connect(<local.sock>)
         ~/.ssh, agent, known_hosts               no credentials, no ssh
```

The seam between the two halves is a socket path in `kanhrd.config.yaml` —
the same string the bridge already reads. Nothing else crosses.

## The command

```
ssh -nNT \
    -o BatchMode=yes \
    -o StreamLocalBindUnlink=yes \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -L <local socket>:<remote socket> <target>
```

Two of those are load-bearing and were verified, not assumed (ADR-0006):

- **`StreamLocalBindUnlink=yes`** — when the tunnel dies the local socket
  *file* survives. A restart over that stale file fails with
  `unix_listener: cannot bind to path …: Address already in use`. This
  option is the fix. Without it, `tunnel up` after a crash fails for a reason
  that looks like nothing to do with ssh.
- **`BatchMode=yes`** — the command never blocks on a prompt. An encrypted
  key with no agent fails fast and says so; it does not sit waiting.

`StrictHostKeyChecking` is never touched. `ExitOnForwardFailure` turns a
silent no-forward into an exit the command can report; `ServerAlive*` turns a
dead link into an exit in ~45s instead of a hang.

## Three failure modes, three answers

ADR-0006's consequence list names these and notes they currently all read as
one grey host. `status` is where they become tellable apart, from the
operator's side, where the tunnel actually is:

| What the operator sees | Cause | What `status` says |
|---|---|---|
| no socket file at the path | never brought up | down, socket missing |
| file present, `connect()` → `ECONNREFUSED` | tunnel process died, file left behind | down, stale socket — `up` clears it |
| connects, then `EPIPE` / closed before a response | tunnel is fine, remote socket path is wrong | up, but the remote path answers nothing |

The third is the one that looks like a working tunnel and is not. `status`
distinguishes it by probing: a socket that accepts a connection and then dies
without a response is not a healthy forward, and saying "up" about it would
be the wrong answer to the only question the operator asked.

## Supervision

`--all` from config is the model. The command reads `kanhrd.config.yaml`,
takes every host that carries an ssh target, and brings up one forward each.
That is the whole inventory question answered: there is no second list, and a
host that is not in the bridge's config is not a host.

Restart is `up` being idempotent: a host already forwarded is left alone, a
host with a stale socket is cleared (`StreamLocalBindUnlink`) and
re-established. Long-running keepalive stays where it already works — the
platform supervisor `docs/OPERATING.md` already reaches for (`launchd`
KeepAlive on macOS, a systemd user unit on Linux) wrapping `kanhrd tunnel up`
rather than a bespoke daemon inside kanhrd.

> ponytail: no daemon, no supervision tree of our own. Add one only if
> operators report that wrapping `up` in launchd/systemd is not enough.

## Docker

The container runs no tunnel. Compose already has a platform split for the
herdr socket mount; a containerized bridge reaching a remote host gets a
mounted `~/.ssh` and `SSH_AUTH_SOCK` and the forward is brought up outside
it. This is a documentation case, not a code case — and an undocumented one
is a silent failure exactly like the socket-mount footgun already noted in
CLAUDE.md: healthcheck green, host `connected:false` forever.
