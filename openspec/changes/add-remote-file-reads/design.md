# Design — remote file reads

## The seam

`RepoFileReader` currently mixes three things: what a file method means,
which machine the file is on, and how git is run. Only the first is
capability logic. So:

```
RepoFileReader (unchanged semantics: caps, encoding, sort, truncation)
  └── HostFilesystem
        ├── LocalFilesystem   node:fs + spawn('git')
        └── SshFilesystem     sftp over the host's control connection
                              + ssh -S <control> -- git -C <cwd> …
```

`HostFilesystem` is deliberately small — `realpath`, `stat`, `readdir`,
`readFile(cap)`, `runGit(args, cwd, cap)` — because everything above it is
already tested and must not be re-tested per transport. `add-ssh-host-transport`
provides the connection; this change provides no transport of its own.

## Why confinement moves down, not up

Confinement today resolves symlinks with `realpathSync` on the bridge's
filesystem. On a remote host that answer is meaningless: the escaping
symlink lives on the far side. So `realpath` becomes a `HostFilesystem`
operation and the check runs where the file is. The check itself — the four
refusals, the nearest-existing-ancestor rule — is unchanged and stays in
`confine.ts`, taking the filesystem as an argument.

This is the part to get right: a confinement bug here reads arbitrary files
on someone else's machine. The suite therefore runs the same confinement
cases against both implementations, from one table.

## Root = cwd

`resolveLocalCheckout` did two jobs: prove the machine, and find the
checkout. The machine job is gone. What remains is:

- `cwd` from `pane.list`, as now (the pane's stable directory, not
  `foreground_cwd` — `project.ts:54` already records why).
- the checkout, only for `repo.status` and `repo.diff`, from
  `git rev-parse --show-toplevel` run on the host in that `cwd`. Its failure
  is `no_checkout`, an ordinary answer rather than a refusal.

`git rev-parse` on the host also replaces the old cross-check that git agreed
with the bridge's own walk-up, which existed only to catch the wrong machine.

## Cost of a remote read

Each `readdir` or `read` is a round trip. The panel already reads on demand,
one directory at a time, so the shape is right; what it lacks is bounds.
One SFTP session per host, requests queued in order, a per-request timeout
that fails the request and not the connection. `repo.status` is polled, so
its interval is the one thing that could turn a slow link into a queue —
the existing `statusPollIntervalMs` cap governs it, and a status request is
skipped while the previous one is in flight, the same rule
`OutputPoller.poll` already applies.

## Testing

- Confinement and reader semantics: one table, run against local and ssh
  filesystems both.
- The ssh filesystem runs against the fake-`ssh` success-mode fixture from
  `add-ssh-host-transport`, pointed at an isolated `kanhrd-test-*` session —
  never the operator's socket, never a live remote.
- Deleted with the gate: `gate.test.ts`, and the `files_not_local` cases
  scattered through `reader.test.ts` and `host-files.test.ts`.
