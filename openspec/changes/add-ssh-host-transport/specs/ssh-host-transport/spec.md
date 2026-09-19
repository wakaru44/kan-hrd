## ADDED Requirements

### Requirement: A host declares how it is reached

`HostConfig` SHALL accept an optional `ssh` block. A host with no `ssh` block
is local: `socket` is a path on the bridge's own filesystem and the bridge
connects to it directly, as it does today. A host with an `ssh` block is
remote: `socket` is a path on the REMOTE machine and the bridge SHALL NOT
resolve it against its own filesystem or expand `~` against its own `$HOME`.

The block SHALL carry `target` (a `Host` alias from the user's ssh config, or
`user@hostname`), and MAY carry `config_file` (passed as `-F`) and
`options` (extra `-o` settings, in the user's own syntax).

#### Scenario: A local host is unaffected

- **WHEN** a host is configured with `socket` and no `ssh` block
- **THEN** the bridge connects to that path directly and starts no ssh process

#### Scenario: A remote socket path is not resolved locally

- **WHEN** a remote host's `socket` is `~/.config/herdr/herdr.sock`
- **THEN** the bridge passes that path to the remote side untouched and does
  not require it to exist on its own machine

### Requirement: The bridge owns the connection

For a remote host the bridge SHALL establish the transport itself before
opening any herdr connection, and SHALL keep it up for the process's
lifetime. It SHALL spawn the system `ssh` client as a supervised child with a
control master and a forward from a private local socket to the host's remote
`socket`, and SHALL give the local socket path to the herdr client. The
operator SHALL NOT have to create, restart or clean up any tunnel.

Every configuration the user already has SHALL apply, because the real client
reads it: `~/.ssh/config` (or the named `config_file`), the agent at
`SSH_AUTH_SOCK`, `known_hosts`, and `ProxyJump`.

#### Scenario: The operator starts the bridge with a remote host

- **WHEN** the bridge starts with a host whose `ssh.target` names an entry in
  the user's ssh config, and the agent holds a usable key
- **THEN** the host reaches `connected` with no operator action beyond
  starting the bridge

#### Scenario: A jump host is honoured

- **WHEN** the target's ssh config entry carries `ProxyJump`
- **THEN** the connection is made through it, resolved by the ssh client and
  not by kanhrd

### Requirement: The transport reconnects and reports why it is down

A remote host SHALL carry a transport state — `connecting`, `connected`, or
`disconnected` with a machine-readable reason and a human-readable message.
The reasons SHALL distinguish at least: `ssh_missing` (no ssh binary),
`auth_failed` (no usable key; the agent is the fix), `host_key_unknown`
(the key is not in `known_hosts`), `unreachable` (network or name
resolution), `remote_socket_missing` (herdr is not listening there), and
`lost` (an established link dropped).

The supervisor SHALL retry with bounded exponential backoff, SHALL NOT retry
faster than the backoff on repeated failure, and SHALL surface the state to
clients through the existing host summary. A remote host that is down SHALL
answer host-scoped methods with `host_unavailable` exactly as a
disconnected local host does.

#### Scenario: The agent holds no key

- **WHEN** the ssh client exits reporting no usable authentication method
- **THEN** the host is `disconnected` with reason `auth_failed`, the message
  names adding the key to the agent, and the bridge retries on backoff

#### Scenario: herdr is not running on the far side

- **WHEN** the connection succeeds but the remote `socket` path does not
  exist
- **THEN** the host is `disconnected` with reason `remote_socket_missing`
  and the message names the path and the host

#### Scenario: An established link drops

- **WHEN** the network goes away under a connected host
- **THEN** the host becomes `disconnected` with reason `lost`, reconnects
  when the network returns, and the SPA is told both times

### Requirement: The control connection is reusable by later reads

The transport SHALL expose the established connection as a control socket
that other bridge code can run a command over without a second handshake or
a second authentication. The control socket SHALL live in a directory owned
by the bridge's user with permissions `0700`, and SHALL be removed when the
host stops.

#### Scenario: A command runs on the far side

- **WHEN** bridge code asks the transport to run a command on a connected
  remote host
- **THEN** it runs over the existing control connection, with no new
  authentication

### Requirement: kanhrd never prompts for or stores a secret

The bridge SHALL run the ssh client with `BatchMode=yes` so that no password
or passphrase prompt can ever block it, SHALL NOT read, copy, log or store
private key material, and SHALL NOT weaken host key checking — it SHALL NOT
pass `StrictHostKeyChecking=no` or an equivalent, and SHALL NOT write to
`known_hosts` on the user's behalf. Authentication SHALL be the agent or the
keys the user's own config names.

#### Scenario: An encrypted key with no agent

- **WHEN** the only identity is a passphrase-protected key and no agent holds
  it
- **THEN** the host fails with `auth_failed` rather than prompting, and the
  bridge blocks on nothing

#### Scenario: An unknown host key

- **WHEN** the target's host key is absent from `known_hosts`
- **THEN** the connection fails with `host_key_unknown`, the bridge accepts
  nothing on the user's behalf, and the message names verifying the key with
  `ssh` directly

### Requirement: Diagnosable startup and failure logging

On start the bridge SHALL log, per remote host, the target and the remote
socket path it will use. On a transport failure it SHALL log the reason, the
host, and the ssh client's own last error output, with no key material and no
full command line containing user-supplied secrets.

#### Scenario: The operator misspells a target

- **WHEN** `ssh.target` names no resolvable host
- **THEN** the log names the host, the target as typed, and `unreachable`
