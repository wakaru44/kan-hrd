## 1. Config: a host says where it is

- [ ] 1.1 Add the optional per-host fields the tunnel command needs (ssh
      target, remote socket path) to `HostConfig` and `RawConfigFile`, in the
      file's existing snake_case convention.
- [ ] 1.2 Leave the bridge's use of `HostConfig` untouched — it still reads
      `socket` and connects. Assert a local host's path is unchanged.
- [ ] 1.3 Do not resolve the remote socket path against the bridge's own
      filesystem or `$HOME`; it belongs to the far machine.
- [ ] 1.4 Unit tests per config shape, including a host with no ssh target.

## 2. The CLI entry point

- [ ] 2.1 A `kanhrd` binary with a `tunnel` command group and the three
      subcommands; `--all` and explicit host names on each.
- [ ] 2.2 Exit codes: non-zero on an unknown host name, on any failed `up`,
      and on any unhealthy host in `status`.
- [ ] 2.3 No credential flag, env var or config key exists — assert it.

## 3. The ssh invocation

- [ ] 3.1 Pure argv builder: host config -> argv, per `design.md`'s command.
- [ ] 3.2 Unit tests asserting `StreamLocalBindUnlink=yes` and
      `BatchMode=yes` are always present and that nothing weakens
      `StrictHostKeyChecking`.
- [ ] 3.3 Missing `ssh` binary reports that reason and attempts no fallback.

## 4. up / down

- [ ] 4.1 `up` is idempotent: a healthy forward is left alone, a stale one is
      re-established over its leftover socket file.
- [ ] 4.2 `down` stops what was started and leaves no socket file; it exits
      zero when nothing is running.
- [ ] 4.3 `--all` continues past a failing host and reports every outcome.

## 5. status

- [ ] 5.1 Health by connecting, never by the socket file existing.
- [ ] 5.2 Classify and report the three modes: missing socket, stale socket
      (`ECONNREFUSED`), and channel-closed-without-response (wrong remote
      path), each with the action that clears it.
- [ ] 5.3 Report host, up/down, local socket path, last error.

## 6. Tests without a network

- [ ] 6.1 Committed fixtures, not `/tmp` scripts: a fake `ssh` on `PATH` with
      a success mode and each failure mode, under the bridge's integration
      fixtures with a README.
- [ ] 6.2 Suite for the three `status` classifications against real socket
      states (absent file, orphaned file, forward to a dead remote path).
- [ ] 6.3 Success mode runs against an isolated `kanhrd-test-*` herdr
      session; assert no path reaches the default socket.

## 7. Docs (a requirement, not a task — see the spec)

- [ ] 7.1 `docs/OPERATING.md`: the forward-direction recipe mirroring §3,
      including keeping it up with `launchd`/systemd user unit.
- [ ] 7.2 A how-to: adding a host from an existing ssh config entry, the
      three failure modes and their fixes, and the Docker case (no tunnel in
      the container; mounted `~/.ssh` + `SSH_AUTH_SOCK`).
- [ ] 7.3 Link the how-to from BOTH the quickstart and the full user guide.
- [ ] 7.4 `docs/CONTEXT.md` vocabulary; every documented host-config key
      matches the parser.

## 8. Gates

- [ ] 8.1 `openspec validate add-tunnel-command --strict`.
- [ ] 8.2 Bridge typecheck, unit and integration suites; `make build`.
- [ ] 8.3 `pre-commit run --all-files`.
