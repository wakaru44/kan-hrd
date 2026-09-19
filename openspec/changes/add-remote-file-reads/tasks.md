## 0. Precondition

- [ ] 0.1 `add-ssh-host-transport` sections 1-4 landed: a remote host
      connects and its transport exposes `exec()` over the control socket.

## 1. The filesystem seam

- [ ] 1.1 Define `HostFilesystem` (`realpath`, `stat`, `readdir`,
      `readFile`, `runGit`) and move the local implementation behind it with
      no behaviour change; suites stay green untouched.
- [ ] 1.2 Take the filesystem as an argument in `confine.ts` and resolve real
      paths through it.
- [ ] 1.3 `RepoFileReader` gets its filesystem from the host, not from
      `node:fs`.

## 2. The ssh filesystem

- [ ] 2.1 SFTP session per host over the host's connection: open lazily,
      one in flight, queue, close with the host.
- [ ] 2.2 `runGit` over the control socket, with the same argv and the same
      `diff-index` rule as local — assert the read-only guarantee holds
      remotely too.
- [ ] 2.3 Per-request timeout that fails one request and leaves the host
      connected.

## 3. Root and gate

- [ ] 3.1 Replace `localCheckout` with root resolution: `cwd` for tree and
      read; checkout from `git rev-parse --show-toplevel` on the host for
      status and diff.
- [ ] 3.2 Delete `gate.ts`, `filesLocalHint`, `gate.test.ts` and the
      `files_not_local` code path.
- [ ] 3.3 New refusals: `files_disabled`, `no_working_directory`,
      `read_timeout`; `path_outside_checkout` becomes `path_outside_root`.

## 4. Wire and SPA

- [ ] 4.1 `packages/schema`: `files_local` -> `files_available` +
      `git_available`.
- [ ] 4.2 SPA file panel reads the new flags; git views appear only with
      `git_available`, and a pane with a `cwd` and no checkout browses.
- [ ] 4.3 Copy for the new refusals per `docs/BRAND.md`.

## 5. Tests

- [ ] 5.1 One confinement/semantics table run against both filesystems.
- [ ] 5.2 ssh filesystem against the fake-`ssh` fixture and an isolated
      `kanhrd-test-*` session; assert nothing reaches the default socket.
- [ ] 5.3 Timeout, queueing, and "host goes down mid-read" cases.

## 6. Docs

- [ ] 6.1 `docs/how-to/ssh-hosts.md` gains the file-panel section; the
      `files: false` switch is documented as the operator's opt-out, no
      longer as a workaround for a guess.
- [ ] 6.2 `docs/CONTEXT.md` entries for `files_available` / `git_available`.

## 7. Gates

- [ ] 7.1 `openspec validate --strict`.
- [ ] 7.2 Bridge + web typecheck, unit and integration suites, `make build`.
- [ ] 7.3 `pre-commit run --all-files`.
