## 1. Config: a host declares its transport

- [ ] 1.1 Add the optional `ssh` block (`target`, `config_file`, `options`)
      to `HostConfig` and `RawConfigFile`, and parse it.
- [ ] 1.2 Stop resolving a remote `socket` locally: `~` and relative paths on
      an ssh host are the remote machine's, not the bridge's.
- [ ] 1.3 Reject a config that is ambiguous or unsafe at load: an `ssh` block
      with no `target`, or `options` that would weaken `BatchMode` or
      `StrictHostKeyChecking`.
- [ ] 1.4 Unit tests for each shape, including the tilde case.

## 2. The ssh argv builder

- [ ] 2.1 Pure function: config -> argv, per `design.md`'s command.
- [ ] 2.2 Control path: `0700` runtime dir, hashed socket name, under the
      platform's socket path length limit.
- [ ] 2.3 Unit tests asserting the security-relevant flags are present and
      cannot be overridden by user `options`.

## 3. The supervisor

- [ ] 3.1 Spawn, hold, and stop the child; remove the control and forwarded
      sockets on stop and on a crashed previous run's leftovers.
- [ ] 3.2 Classify exit + stderr into the six reasons; keep the client's last
      error text for the log.
- [ ] 3.3 Bounded exponential backoff with reset after a healthy period.
- [ ] 3.4 Probe the forward with one herdr request before reporting
      `connected`.
- [ ] 3.5 Expose `exec()` over the control socket for later capabilities.

## 4. Wire it into HostRuntime

- [ ] 4.1 A remote host starts its transport before its herdr client and
      points the client at the forwarded socket.
- [ ] 4.2 Transport state feeds the existing host summary and the
      `host_unavailable` path; no new refusal vocabulary for callers.
- [ ] 4.3 A local host's path through `HostRuntime` is unchanged — assert it.

## 5. Tests without a network

- [ ] 5.1 Commit the fake `ssh` fixture (failure modes + success mode) under
      the bridge's integration fixtures, with a README describing it.
- [ ] 5.2 Supervisor suite against the fixture: every reason, backoff, and
      reconnect.
- [ ] 5.3 Success mode runs against an isolated `kanhrd-test-*` herdr
      session; assert no path reaches the default socket.

## 6. SPA + copy

- [ ] 6.1 Surface the reason on the host in the rail/notices using the
      existing host-notice path.
- [ ] 6.2 Copy strings per `docs/BRAND.md`; the `auth_failed` next-step
      wording waits on the maintainer's call recorded in `design.md`.

## 7. Ops and docs

- [ ] 7.1 `openssh-client` in the Docker image; mount `~/.ssh` read-only and
      pass `SSH_AUTH_SOCK`; note the macOS/Linux difference alongside the
      existing socket-mount note.
- [ ] 7.2 `docs/how-to/ssh-hosts.md`: laptop, container, jump host, and the
      three failures an operator will actually hit.
- [ ] 7.3 `docs/OPERATING.md` and `docs/CONTEXT.md` updated; the example
      config file grows a remote host.

## 8. Gates

- [ ] 8.1 `openspec validate --strict`.
- [ ] 8.2 Bridge typecheck, unit and integration suites; `make build`.
- [ ] 8.3 `pre-commit run --all-files`.
