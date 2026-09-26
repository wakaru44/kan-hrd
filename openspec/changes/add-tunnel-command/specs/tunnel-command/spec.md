## ADDED Requirements

### Requirement: kanhrd provides `tunnel up`, `tunnel down` and `tunnel status`

kanhrd SHALL provide a command-line entry point with a `tunnel` command group
carrying exactly three subcommands.

`kanhrd tunnel up` SHALL establish a forward that lands a Unix socket on the
bridge's machine, connected to a herdr socket on a remote machine, and SHALL
be idempotent: a host whose forward is already healthy is left running, and a
host whose forward is down is re-established.

`kanhrd tunnel down` SHALL stop the forwards this command started and SHALL
leave no socket file behind that a later `up` would have to work around. It
SHALL NOT fail when a named host has no forward running.

`kanhrd tunnel status` SHALL report the state of each configured host's
forward and SHALL change nothing.

Each subcommand SHALL accept one or more host names, and SHALL exit non-zero
when a named host is not in the configuration.

#### Scenario: Bringing a single host up

- **WHEN** the operator runs `kanhrd tunnel up alpaca01` with `alpaca01`
  configured as a remote host
- **THEN** a socket file exists at that host's configured socket path, the
  bridge can connect to it, and the command reports the host as up

#### Scenario: Up twice in a row

- **WHEN** `kanhrd tunnel up alpaca01` is run while that host's forward is
  already healthy
- **THEN** the existing forward is left running, no second forward is
  started, and the command exits zero

#### Scenario: Down with nothing running

- **WHEN** `kanhrd tunnel down alpaca01` is run and no forward for that host
  is running
- **THEN** the command exits zero, says so, and removes nothing it did not
  create

### Requirement: `--all` takes its host list from the bridge configuration

`kanhrd tunnel up --all` SHALL read the same configuration file the bridge
reads, SHALL select every host that declares a remote ssh target, and SHALL
bring up one forward per selected host. `down --all` and `status` with no
host argument SHALL use the same selection.

There SHALL be no second inventory of hosts: a host that is not in the bridge
configuration is not a host the tunnel command knows. Configuration keys the
command reads SHALL follow the file's existing snake_case convention, and a
host with no ssh target SHALL be treated as local and skipped silently.

A host selected by `--all` whose forward fails SHALL NOT prevent the
remaining hosts from being brought up; the command SHALL report each host's
outcome and exit non-zero if any failed.

#### Scenario: Two remote hosts and one local

- **WHEN** the configuration holds a local host and two hosts with ssh
  targets, and the operator runs `kanhrd tunnel up --all`
- **THEN** two forwards are established, the local host is skipped, and the
  command reports all three states

#### Scenario: One of several hosts fails

- **WHEN** `--all` covers two remote hosts and one is unreachable
- **THEN** the reachable host's forward is established anyway, the failing
  host is reported with its reason, and the command exits non-zero

### Requirement: The forward is a native ssh process the operator owns

The command SHALL establish the forward by executing the system `ssh` binary
with a Unix-to-Unix local forward from the host's configured socket path to
its configured remote socket path. It SHALL NOT implement the SSH protocol,
parse `~/.ssh/config`, read key material, or verify host keys itself: keys,
host configuration, `known_hosts`, `ProxyJump` and the agent all belong to
the user's ssh client, which the command invokes and does not replace.

The command SHALL pass `-o StreamLocalBindUnlink=yes` on every invocation, so
that a socket file left behind by a dead forward does not make the next `up`
fail to bind. It SHALL pass `-o BatchMode=yes` on every invocation, so that
no prompt can block it. It SHALL NOT pass `StrictHostKeyChecking=no` or any
equivalent relaxation, and SHALL NOT write to `known_hosts` on the operator's
behalf.

When the `ssh` binary is absent the command SHALL fail with that as the
stated reason rather than attempting any fallback.

#### Scenario: Restarting over a stale socket file

- **WHEN** a previous forward died leaving its socket file in place and the
  operator runs `kanhrd tunnel up` for that host
- **THEN** the forward is re-established over that path and the command does
  not fail with an address-already-in-use error

#### Scenario: An encrypted key with no agent

- **WHEN** the only identity for a host is a passphrase-protected key and no
  agent holds it
- **THEN** the command fails with an authentication reason and at no point
  waits for a passphrase

#### Scenario: A jump host

- **WHEN** the operator's ssh configuration reaches the target through
  `ProxyJump`
- **THEN** the forward is established through it, resolved by the ssh client,
  with no jump-host knowledge in kanhrd

### Requirement: The tunnel runs in the operator's session and the bridge is unchanged

The forward SHALL run as a process in the operator's own session, beside the
credentials that session already holds. The bridge SHALL NOT spawn,
supervise, configure or depend on any `ssh` process, and SHALL continue to
reach every host by connecting to a socket path exactly as it does for a
local host.

The bridge SHALL hold no credential of any kind for a remote host: no key
path, no passphrase, no agent socket, no host-key policy. Per-host
configuration fields added for the tunnel command SHALL be inert to the
bridge, which SHALL keep reading only the fields it reads today.

Stopping or restarting the bridge SHALL NOT stop a forward, and stopping a
forward SHALL NOT require restarting the bridge — the host simply goes down
and comes back through the bridge's existing per-host reconnect path.

#### Scenario: The bridge starts with no tunnel running

- **WHEN** the bridge starts and a remote host's forward is not up
- **THEN** that host reports as disconnected with its error, every other host
  works, and the bridge starts no ssh process

#### Scenario: A forward comes up under a running bridge

- **WHEN** `kanhrd tunnel up` is run while the bridge is already running
- **THEN** the host reconnects through the bridge's existing backoff with no
  bridge restart

#### Scenario: The bridge's credential posture is unchanged

- **WHEN** the bridge process is inspected while a remote host is connected
- **THEN** it holds no ssh target, key path, agent socket or ssh child
  process, and a browser client receives none of them

### Requirement: `status` reports each host's forward and tells the failure modes apart

For every selected host, `kanhrd tunnel status` SHALL report the host name,
whether its forward is up or down, the local socket path in use, and, when
the forward is not healthy, the last error.

It SHALL distinguish at least these three states, which are otherwise
indistinguishable to an operator looking at the board:

1. **No socket file** at the configured path — the forward was never brought
   up. Reported as down.
2. **Socket file present, connection refused** — the forward died and left
   its file behind. Reported as down, and identified as a stale socket that
   `up` will clear, not as a missing forward.
3. **Connection accepted but the channel closes without a response** — the
   forward is alive and the remote socket path is wrong or herdr is not
   listening there. Reported as reaching the far side but not herdr, naming
   the remote path.

A host SHALL NOT be reported as up on the strength of the socket file
existing: `status` SHALL determine health by connecting.

`status` SHALL exit non-zero when any selected host's forward is not healthy.

#### Scenario: Never brought up

- **WHEN** `status` runs for a host whose socket path does not exist
- **THEN** it reports the host down with the socket path and the reason that
  no forward is running

#### Scenario: A dead forward left its socket file

- **WHEN** the ssh process for a host has died and its socket file remains
- **THEN** `status` reports the host down, identifies the socket as stale,
  and names `kanhrd tunnel up` as the action that clears it

#### Scenario: The remote socket path is wrong

- **WHEN** the forward is established but the configured remote socket path
  does not hold a listening herdr
- **THEN** `status` reports that the tunnel reaches the host but the remote
  path answers nothing, and names that path

### Requirement: The command never accepts or stores a secret

The command SHALL NOT accept a password, passphrase or private key as an
argument, an environment variable, a prompt, or a configuration value, and
SHALL NOT write any secret to disk, to its output, or to a log. Any output
that echoes an invocation SHALL be safe to paste into an issue.

Authentication SHALL be whatever the operator's ssh agent and ssh
configuration already provide. kanhrd SHALL NOT read private key files and
SHALL NOT copy or forward agent credentials.

#### Scenario: No credential flag exists

- **WHEN** an operator looks for a way to give kanhrd a password or key
- **THEN** no such flag, environment variable or configuration key exists,
  and the documentation directs them to their ssh agent and ssh config

#### Scenario: Output is safe to share

- **WHEN** `status` or a failing `up` prints what it ran
- **THEN** the output carries host names, socket paths, targets and ssh's own
  error text, and no key material or passphrase

### Requirement: The operator path is documented before the feature is done

A remote host SHALL be documented as an operator-facing recipe, not only as a
config key or a command name. A feature with no documentation is not a
feature.

`docs/OPERATING.md` SHALL carry a forward-direction recipe — a bridge
reaching out to a remote herdr host — alongside its existing reverse-tunnel
recipe, including keeping the forward up across reboots with the platform's
own supervisor.

A how-to SHALL cover: adding a host from an ssh config entry the operator
already uses, the three `status` failure modes with the action that clears
each, and the Docker case, where the container runs no tunnel and instead
receives a mounted `~/.ssh` and `SSH_AUTH_SOCK`.

`docs/CONTEXT.md` SHALL define the vocabulary this capability introduces, and
every document naming a host-config key SHALL name the key the parser
actually reads.

The how-to SHALL be linked from BOTH the repository `README.md`'s "Getting
started" section and `docs/USER-GUIDE.md`; documentation that exists only
where an operator does not look has not been written.

#### Scenario: An operator adds their second machine

- **WHEN** an operator who already reaches a machine with `ssh alpaca01`
  wants it on the board
- **THEN** one documented recipe takes them from that to a host on the board,
  with no step requiring them to read the source

#### Scenario: Both entry points lead to the recipe

- **WHEN** an operator starts from `README.md`'s "Getting started", and
  another starts from `docs/USER-GUIDE.md`
- **THEN** each finds a link to the remote-host how-to without knowing it
  exists

#### Scenario: The container case is covered

- **WHEN** the bridge runs in Docker and a remote host is wanted
- **THEN** the documentation states that no tunnel runs in the container and
  gives the `~/.ssh` mount and `SSH_AUTH_SOCK` the case requires

#### Scenario: A documented key matches the parser

- **WHEN** any document names a host-config key
- **THEN** it is the key `apps/bridge/src/config.ts` actually reads
