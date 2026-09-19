# Design — ssh host transport

## The decision: drive the user's `ssh`, do not reimplement it

Two ways to reach a remote herdr socket from Node:

| | OpenSSH child (**chosen**) | `ssh2` in-process |
|---|---|---|
| Config | the real client reads `~/.ssh/config`, `Include`, `Match`, `ProxyJump` | we parse a subset ourselves |
| Host keys | `known_hosts`, exactly as the user's other tools | we verify by hand |
| Auth | agent, hardware keys, whatever already works for them | agent support only, our code |
| Unix socket | `-L local.sock:remote.sock` | `direct-streamlocal@openssh.com` channel |
| Cost | a child process and a socket file per host | none |
| Risk | argv construction, process supervision | a security-relevant reimplementation that drifts from the client the user trusts |

The user's requirement was that kanhrd carries the burden, not them. Reading
their existing config is how that is met — a second, partial config parser
would hand the burden back the first time a `Match` block or a jump host is
ignored. So: spawn `ssh`.

## Shape

One `SshTransport` per remote host, owned by `HostRuntime`:

```
ssh -M -N -o ControlMaster=yes -o ControlPath=<ctl> -o ControlPersist=no \
    -o BatchMode=yes -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    [-F <config_file>] [-o <user option>]... \
    -L <run>/<host>.sock:<remote socket> <target>
```

- `ExitOnForwardFailure=yes` is what turns "the forward silently did not
  happen" into a process exit the supervisor can report.
- `ServerAlive*` is what makes a dead link become `lost` in ~45s rather than
  hanging a request forever.
- `ControlPersist=no` keeps the master's life exactly the child's life — no
  stray connection outliving the bridge.
- `<run>` is a `0700` directory under the bridge's runtime dir. Socket paths
  have a ~104 byte limit on macOS, so the name is `<short hash>.sock`, not
  the host name.

`HerdrClient` is handed `<run>/<host>.sock` and is otherwise untouched: it
still opens one connection per request and a dedicated one per subscription
(`client.ts:108-113,181`), now multiplexed by ssh over one TCP connection.

## State machine

`connecting → connected → disconnected(reason) → connecting …`

The reason comes from classifying the child's exit and its stderr's last
line: permission/`Permission denied` → `auth_failed`; `Host key verification
failed` → `host_key_unknown`; `Could not resolve`/`Connection refused`/
timeout → `unreachable`; forward failure naming the remote path →
`remote_socket_missing`; ENOENT on spawn → `ssh_missing`; anything else after
a healthy period → `lost`. Backoff: 1s doubling to 30s, reset on a link that
stayed up past 30s.

"Connected" means the forward is usable, not merely that ssh is running: the
supervisor probes the local socket with one cheap herdr request before it
calls the host connected. That is what separates `remote_socket_missing` from
a working host.

## Testing without a network

Committed fixtures, not one-off scripts (CLAUDE.md):

- **argv builder**: a pure function, unit-tested per config shape. This is
  where `BatchMode`, `StrictHostKeyChecking` and remote-path handling are
  asserted, including that no option can be injected to weaken them.
- **supervisor**: a fake `ssh` executable placed on `PATH` by the fixture,
  scripted to exit with each real failure's stderr, plus a success mode that
  forwards a local socket to a fixture herdr. The state machine, the
  classifier and the backoff are tested against it.
- **no live ssh in CI**, and no test touches the operator's herdr socket —
  the success mode is wired to a `kanhrd-test-*` session like every other
  herdr-touching suite.

## Open question for the maintainer

The SPA must say what a down host's reason means, in the brand voice.
`docs/BRAND.md` covers voice and `docs/UX-GUIDELINES.md` says an empty state
is a next step — both apply, and `auth_failed`'s next step ("add the key to
your agent") is a shell command the user runs outside kanhrd. Whether the UI
may name a command at all is not settled by the three docs. Flagged rather
than invented; the copy task lands after a maintainer's call.
