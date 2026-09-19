## ADDED Requirements

### Requirement: Outbound SSH carries no kanhrd-held credentials

Where the bridge connects outward to a herdr host over SSH, it SHALL
authenticate only through the user's ssh agent or the identities their own
ssh configuration names. The bridge SHALL NOT accept, store, or forward
passwords or passphrases, SHALL NOT read private key files itself, and SHALL
NOT relax host key verification. A browser client SHALL never receive an ssh
target, key path, control socket path, or any part of the ssh client's
command line.

#### Scenario: A client asks for host detail

- **WHEN** the SPA reads a remote host's summary
- **THEN** it receives the host name, its connection state and a reason, and
  no ssh target, path or credential

#### Scenario: The bridge logs a transport failure

- **WHEN** an ssh connection fails
- **THEN** the log carries the host, the reason and the client's error text,
  and no key material
