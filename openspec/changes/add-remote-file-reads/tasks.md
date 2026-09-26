## 0. Precondition

- [ ] 0.1 `add-tunnel-command` has landed: the `kanhrd` CLI exists and
      `kanhrd tunnel up` raises a forward per configured remote host. This
      change adds a subcommand to that CLI and a second forward to that
      command; it does not build either from scratch.

## 1. The seam

- [ ] 1.1 Define `PaneFiles` (`list`, `read`, `status`, `diff`) and put the
      shipped `RepoFileReader` behind it as `LocalPaneFiles`, with no
      behaviour change; the existing suites stay green untouched.
- [ ] 1.2 `dispatch` resolves a pane's `PaneFiles` from its host instead of
      calling the reader directly.

## 2. The reader as a service

- [ ] 2.1 Frame the four methods as newline-delimited JSON over a Unix
      socket: one request line `{ id, method, root, path, … }`, one response
      line carrying the same result shape the bridge already returns or
      `{ code, message }`. One request per line, many per connection.
- [ ] 2.2 `kanhrd files serve --socket <path> [--allow <dir>]…` in the CLI:
      binds the socket (unlinking a stale file), serves the shipped
      `RepoFileReader` over that framing, and exits cleanly on SIGTERM and on
      stdin EOF, so an `ssh` session ending takes it down.
- [ ] 2.3 `--allow` enforcement: refuse any `root` whose real path is not
      inside an allowed directory; default the allowlist to the invoking
      user's home directory. Confinement inside an accepted `root` is the
      shipped rule, unchanged.
- [ ] 2.4 A protocol-version handshake: the reader states its version on
      connect, and a version the bridge does not speak is a clean refusal
      rather than a partial source.

## 3. The remote source

- [ ] 3.1 `RemotePaneFiles`: connect to the host's reader socket, send the
      request, surface the response unchanged. No path logic, no caps, no
      git, no retry inside a request.
- [ ] 3.2 A closed or refused socket becomes `host_unavailable`, matching
      what the host's herdr connection reports at the same moment.
- [ ] 3.3 Per-host source selection: `files: false`, reader socket
      configured, declared-local, else `files_unsupported`; resolved on
      connect and re-resolved on reconnect.
- [ ] 3.4 `host_unavailable` when the host is disconnected, before any source
      is consulted.
- [ ] 3.5 `HostConfig` gains the optional reader socket path, in snake_case
      like every other key in the file.

## 4. Root and gate

- [ ] 4.1 Root becomes the pane's `cwd` for listing and reading; the checkout
      is resolved only for `repo.status` and `repo.diff`, by the source.
- [ ] 4.2 The bridge makes no filesystem call for a pane served by a remote
      source: the `cwd` is passed through as an opaque `root`.
- [ ] 4.3 Delete `gate.ts`, `filesLocalHint`, `gate.test.ts` and the
      `files_not_local` code path.
- [ ] 4.4 New refusals: `files_disabled`, `files_unsupported`,
      `host_unavailable`, `no_working_directory`; `path_outside_checkout`
      becomes `path_outside_root`.

## 5. The tunnel carries it

- [ ] 5.1 `kanhrd tunnel up` adds the second `-L` for a host that configures
      a reader socket, and runs `kanhrd files serve` as the session's remote
      command so the reader shares the forward's lifetime.
- [ ] 5.2 `kanhrd tunnel status` reports the file forward beside the herdr
      one, telling "no reader on the far host" apart from "tunnel down".
- [ ] 5.3 A host with no reader socket configured keeps today's single-forward
      behaviour exactly.

## 6. Wire and SPA

- [ ] 6.1 `packages/schema`: `files_local` → `files_available` +
      `git_available`.
- [ ] 6.2 SPA file panel reads the new flags; git views appear only with
      `git_available`, and a pane with a `cwd` and no checkout browses.
- [ ] 6.3 Copy for the new refusals per `docs/BRAND.md`.

## 7. Tests

- [ ] 7.1 `RemotePaneFiles` against a stub reader on a socket in the test's
      own temp directory: each method, each error code, a truncated result, a
      binary file, and a socket that closes mid-response.
- [ ] 7.2 The coincident-path case: a pane on a reader-backed host whose
      `cwd` also exists on the bridge's machine is answered by the reader,
      and the bridge makes no filesystem call for that path.
- [ ] 7.3 `kanhrd files serve` confinement on its own side: an escaping
      symlink, a `.git` segment, a `root` outside `--allow`.
- [ ] 7.4 Source selection: each of the four outcomes, and re-resolution on
      reconnect.
- [ ] 7.5 Live path against an isolated `kanhrd-test-*` session; assert
      nothing reaches the default socket.

## 8. Docs

- [ ] 8.1 The file panel's reach documented in operator terms: which panes
      show it, which do not, and what to change in each case. Any doc
      describing the panel as local-only is corrected rather than annotated.
- [ ] 8.2 The remote host recipe gains the reader: install kanhrd there,
      configure the reader socket, `kanhrd tunnel up`.
- [ ] 8.3 `docs/CONTEXT.md` entries for `files_available` / `git_available`.

## 9. Gates

- [ ] 9.1 `openspec validate --strict`.
- [ ] 9.2 Bridge + web typecheck, unit and integration suites, `make build`.
- [ ] 9.3 `pre-commit run --all-files`.
