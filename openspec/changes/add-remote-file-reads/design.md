# Design — remote file reads

## The constraint everything else follows from

The bridge holds no credentials. ADR-0003 built it that way and ADR-0006
rejected its option C for proposing otherwise: the bridge does not spawn
`ssh`, does not read a private key, does not reach `SSH_AUTH_SOCK` and owns
no `known_hosts` policy. Its whole knowledge of a remote host is a Unix
socket path in `kanhrd.config.yaml`.

The credentials live one process over, in the operator's session:

```
operator session                          bridge process
  kanhrd tunnel up --all                    HerdrClient
    └─ ssh -L <local.sock>:<remote.sock>      └─ connect(<local.sock>)
         ~/.ssh, agent, known_hosts               no credentials, no ssh
```

So a remote file read is not a question of what the bridge can reach. It is a
question of what the operator's tunnel can put in front of the bridge as one
more socket.

The second constraint is confinement. A remote checkout's symlinks resolve on
the remote machine: `link -> /etc` under a pane's `cwd` is only knowable
there. Whatever refuses `link/secret.txt` must run on the machine holding the
file. Any design where the bridge decides confinement for a filesystem it
cannot see is wrong before it is slow.

## Decision: a kanhrd reader on the far machine, behind a second forward

`kanhrd tunnel up` opens one ssh session per remote host. That session
carries a second `-L` forward and a remote command:

```
ssh -o StreamLocalBindUnlink=yes -o BatchMode=yes \
    -L <local herdr.sock>:<remote herdr.sock> \
    -L <local files.sock>:<remote files.sock> \
    <target> kanhrd files serve --socket <remote files.sock>
```

On the far machine `kanhrd files serve` is the shipped `RepoFileReader`,
`confine.ts` and `git.ts` behind a Unix socket, answering newline-delimited
JSON in exactly the request and response shapes the bridge already produces
for `repo.tree`, `file.read`, `repo.status` and `repo.diff`. The bridge's
remote source is therefore a transport and nothing else: it writes a request
line, reads a response line, and passes the result up unchanged. There is no
field mapping to keep in sync, because there is no second vocabulary.

Why this one:

- **The bridge stays credential-free**, unchanged. It gains a socket path in
  config, reached with `connect()`, exactly as a herdr socket is.
- **Confinement runs where the symlinks are.** The reader resolves real paths
  on its own machine, which is the only place the answer exists.
- **Latency is the forward's**, measured in ADR-0006 at 0.83ms median per
  request over a unix→unix `-L`, plus network RTT and the work itself. A
  `repo.status` poll with a panel open costs one git run on the far machine
  and one round trip — the same order as the local path, not the ~30–200ms a
  per-request `ssh` spawn costs.
- **One lifecycle, one failure mode.** Both forwards ride the same session,
  so a dropped tunnel greys the host and fails the file read in the same
  instant, through `HostRuntime`'s existing reconnect and `last_error` path.
  There is no state where the board shows a live host whose files are
  unreachable for a separate reason.
- **One implementation.** The local host runs the reader in-process; the
  remote host runs the same code over a socket. A bug fixed in confinement is
  fixed for both.

The trade-off, stated plainly: **it requires kanhrd to be installed on every
remote host whose panes should be readable** — one executable, the same one
`add-tunnel-command` ships, on a machine that already runs herdr.

### The bridge never resolves a remote path

The pane's `cwd` comes from herdr's `pane.list` and is a path on the *far*
machine. The bridge passes it to the reader as an opaque `root` alongside the
client's relative `path`, and never calls `realpath`, `stat` or `readdir` on
it. This is the defect the old gate existed to paper over — a remote `cwd`
that also exists on the bridge's machine used to pass a local stat check and
serve the wrong machine's file. Deleting the gate without this rule would
make that bug silent rather than fix it, so it is a spec requirement with its
own test.

### What the reader refuses

The reader is reachable only through the forward, and anyone who can raise
the forward already has shell on that machine, so it grants no access ssh did
not. It is still worth a boundary: a compromised bridge should not be able to
name any `root` it likes and read the far machine's whole filesystem when the
local path would have confined it to pane directories.

`kanhrd files serve` therefore takes `--allow <dir>`, repeatable, and refuses
any `root` whose real path is not inside an allowed directory. The default is
the invoking user's home directory. Inside an accepted `root`, confinement is
the shipped rule unchanged: no absolute path, no `..` segment, no NUL, no
`.git` segment, and a real path that stays inside the root.

### When the tunnel drops mid-read

The forwarded socket file survives and `connect()` fails `ECONNREFUSED`; an
in-flight request's stream closes without a response line. Both become
`host_unavailable` — the same answer the host's herdr connection is already
giving the board at that moment. Nothing retries inside a request; the SPA
re-asks when the host comes back, and `kanhrd tunnel status` is where the
operator learns why it went.

## Rejected alternatives

- **Per-request `ssh <target> kanhrd files …` from the tunnel process.**
  No remote daemon to supervise, which is genuinely attractive. Rejected on
  ADR-0006's measurements: ~200ms per request bare and ~30ms over
  `ControlMaster`, a whole process spawn per `repo.status` poll while a panel
  is open. It also needs a local endpoint for the bridge to ask *through*, so
  it does not even remove the process it was meant to save — it replaces a
  long-lived reader with a per-request one.
- **A reader installed and supervised on the remote by the operator**
  (systemd user unit, launchd), with the tunnel only forwarding its socket.
  Equivalent transport and equivalent latency. Rejected as the default
  because it is a second thing to install, supervise and keep in version step
  on every host, for no gain over letting the ssh session that already exists
  start and stop it. It remains available to an operator who wants the reader
  up independently of any tunnel, and the reader takes no position on which
  started it.
- **The bridge holds an SSH connection** — a Node SSH library or a
  bridge-spawned `ssh` child — **and reads over SFTP plus `ssh -- git`.**
  Rejected: ADR-0006 option C. Key paths and agent access move into the one
  process built to hold none, widening a bridge compromise from "the sockets
  it was given" to "anything those keys open". SFTP also gives no confinement
  the bridge could trust without re-resolving symlinks remotely anyway.
- **Ship no remote code: mount the remote filesystem (sshfs/rclone) beside
  the bridge.** Rejected: FUSE in the container needs `/dev/fuse` and
  `SYS_ADMIN`; a dropped link hangs reads uninterruptibly instead of failing
  one request; and symlinks resolve against the mount's view, so confinement
  lands on the wrong side again.
- **Push a bundled reader over ssh stdin to `node -` on each call, so nothing
  is installed remotely.** Rejected: it trades an install for a per-request
  interpreter start-up, needs a node runtime on the far machine anyway, and
  makes "which version of the reader answered" unanswerable.
- **Read files through a herdr pane** by sending keystrokes and scraping the
  output. Rejected: it races the agent for its own terminal and there is no
  framing that separates a file's bytes from a program's output.
- **Ask herdr's maintainers for file-read methods on herdr's socket.**
  Rejected: it makes a kanhrd feature wait on another project's release
  cycle and grows another project's API for the board's benefit. kanhrd
  already owns a correct reader; it runs it where the files are.

## Open for the operator

**Is installing kanhrd on every readable remote host acceptable?** The design
above assumes yes, and ships that as the default: one executable, the same
artifact as the `kanhrd` CLI, on a machine that already runs herdr. If the
answer is no, the fallback is not a different transport but a smaller
promise — those hosts answer `files_unsupported`, the board still shows their
panes, and the operator reads files in a terminal as today. Nothing in the
seam below changes either way.

## The seam

One interface, two implementations, chosen per host at connect time:

```
dispatch (unchanged: pane_id -> host, wire shapes, error codes)
  └── PaneFiles
        ├── LocalPaneFiles    the shipped RepoFileReader + confine.ts + git.ts
        └── RemotePaneFiles   the same reader, over the forwarded socket
```

`PaneFiles` is `list`, `read`, `status`, `diff` — the four methods, nothing
below them. It is deliberately not a filesystem interface (`realpath`, `stat`,
`readdir`): a filesystem seam would make the bridge re-implement confinement
for a machine it cannot see, which is the bug this change exists to remove.

`RemotePaneFiles` therefore holds no path logic, no caps and no git. It sends
`{ method, root, path, … }`, reads the response line, and surfaces the
reader's `{ code, message }` as `RepoFileError` unchanged — the codes are the
bridge's own, because the reader is the bridge's own code.

## Choosing the source

No stat, no walk-up, no machine guess. Per host, in order:

1. `files: false` → every method answers `files_disabled`.
2. the host config names a reader socket → `RemotePaneFiles`.
3. the host is declared local in config → `LocalPaneFiles`, exactly as today.
4. otherwise → `files_unsupported`, naming what is needed: a
   `kanhrd files serve` on that host and the socket its forward lands here.

A host that is not connected answers `host_unavailable` before any of this.
Step 2 is confirmed once per connection by a handshake the reader answers
with its protocol version; a version the bridge does not speak is
`files_unsupported` naming the version, not a half-working source.

The shipped default host is local, so a single-machine operator sees no
change.

## Root = cwd

`resolveLocalCheckout` did two jobs: prove the machine, and find the
checkout. The machine job is gone — the source is configured, not sniffed.
What remains:

- `cwd` from `pane.list`, as now — the pane's stable directory, not
  `foreground_cwd` (`apps/bridge/src/herdr/project.ts:54` records why).
- the checkout, only for `repo.status` and `repo.diff`, resolved where the
  files are: by `git rev-parse --show-toplevel` run by whichever side holds
  them. Its absence is `no_checkout`, an ordinary answer rather than a
  refusal.

`git_available` on the pane is a hint, not an authority: it is set when the
source reports a checkout for the `cwd` and absent when that is unknown. The
git methods answer `no_checkout` authoritatively on every call.

## Testing

- The reader semantics suite stays where it is, against `LocalPaneFiles`.
  Nothing about the local path changes, so nothing about its tests changes.
- `RemotePaneFiles` is tested against a stub reader on a socket in the test's
  own temp directory: each method, each error code, a truncated result, a
  binary file, and a socket that closes mid-response.
- The coincident-path test: a pane whose `cwd` exists on the bridge's machine
  too, on a host with a reader socket, is answered by the reader — and the
  bridge makes no filesystem call for that path at all.
- `kanhrd files serve` is tested directly for confinement on its own side,
  including an escaping symlink and a `root` outside `--allow`.
- Deleted with the gate: `gate.test.ts`, and the `files_not_local` cases in
  `reader.test.ts` and `host-files.test.ts`.
- Any herdr-touching suite runs against its own `kanhrd-test-*` session,
  never the operator's socket.
