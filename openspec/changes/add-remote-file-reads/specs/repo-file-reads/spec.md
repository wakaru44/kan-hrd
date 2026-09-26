## ADDED Requirements

### Requirement: Files are read where the pane is, by a source the operator configures

The bridge SHALL read a pane's files through a source chosen per host, never
by testing whether a path exists on the bridge's own machine. The bridge SHALL
resolve a host's source in this order and SHALL re-resolve it when the host
reconnects:

1. a host configured `files: false` SHALL refuse every file method with
   `files_disabled`;
2. a host whose configuration names a reader socket SHALL be served by
   calling kanhrd's read-only file reader over that socket;
3. a host the operator has declared local SHALL be served by the bridge's own
   filesystem and `git`, in process, exactly as the shipped local
   implementation does;
4. any other host SHALL answer `files_unsupported`, naming what is missing.

A host that is not connected SHALL answer `host_unavailable` before its source
is consulted, and a pane for which herdr reported no `cwd` SHALL answer
`no_working_directory`. There SHALL be no `files_not_local` refusal.

The reader socket SHALL be a Unix socket on the bridge's own machine, landed
there by the operator's tunnel and reached with `connect()` like a herdr
socket. The bridge SHALL NOT spawn `ssh`, read key material, reach an SSH
agent, or open any connection of its own to a remote machine, and SHALL hold
no credential for one.

Where a host's source is a reader socket, the bridge SHALL NOT resolve paths,
enforce caps or run `git` itself: it SHALL pass the pane's working directory
through as an opaque root together with the client's relative path, and SHALL
surface the reader's result and refusal unchanged. The bridge SHALL make no
filesystem call for a path belonging to such a pane.

#### Scenario: A pane on a remote host

- **WHEN** a pane on a connected host with a reader socket reports a `cwd`
  that does not exist on the bridge's machine
- **THEN** the bridge calls the reader for that root and `repo.tree` lists the
  directory from the machine the reader runs on

#### Scenario: A local path that coincides with a remote one

- **WHEN** a pane on such a host reports a `cwd` that also exists on the
  bridge's own machine
- **THEN** the bridge still answers from the reader, never from its own
  filesystem, and stats nothing locally for that path

#### Scenario: A host with no reader

- **WHEN** a connected host names no reader socket and is not declared local
- **THEN** every file method answers `files_unsupported`, naming the reader
  the host needs, and reads nothing

#### Scenario: The tunnel drops mid-read

- **WHEN** the forward carrying a host's reader socket dies while a
  `file.read` is in flight
- **THEN** the bridge answers `host_unavailable`, reads nothing from its own
  filesystem, and resolves the source again when the host reconnects

#### Scenario: The host is down

- **WHEN** a host is disconnected and a client calls `file.read`
- **THEN** the bridge answers `host_unavailable` and reads nothing

#### Scenario: The operator disables a host

- **WHEN** a host is configured with `files: false`
- **THEN** every file method for its panes answers `files_disabled`

### Requirement: The reader confines every read to directories it was given

kanhrd's file reader SHALL run on the machine holding the files and SHALL
serve the four file methods over a Unix socket, as one request per line and
one response per request, in the same result and error shapes the bridge
returns for a local host. It SHALL accept a set of allowed directories,
defaulting to the invoking user's home directory, and SHALL refuse any root
whose real path is not inside one of them. Within an accepted root it SHALL
apply the same confinement rule as a local read.

The reader SHALL exit when the session that started it ends, so that a reader
never outlives the forward that reaches it.

#### Scenario: A root outside the allowed directories

- **WHEN** a request names a root that is not inside any allowed directory
- **THEN** the reader refuses with `path_outside_root` and reads nothing

#### Scenario: The forward ends

- **WHEN** the ssh session carrying a host's forwards ends
- **THEN** the reader it started exits, and the next file call for that host
  answers `host_unavailable`

## REMOVED Requirements

### Requirement: Files are served only from the bridge's own machine

**Reason**: The gate guessed machine identity by stat-ing paths locally,
which it could not do correctly — its own scenarios were about the wrong
machine's checkout being served. With the file source configured per host,
the bridge stops guessing: a remote pane's files come from a kanhrd reader on
that pane's own machine, over a socket the operator's tunnel lands beside the
herdr one. The operator's `files: false` switch survives, in "Files are read
where the pane is, by a source the operator configures".

**Migration**: `files_not_local` is removed from the wire; clients read
`files_available` and `git_available` on the pane instead.

## RENAMED Requirements

- FROM: `### Requirement: Paths are confined to the checkout`
- TO: `### Requirement: Paths are confined to the pane's directory`

## MODIFIED Requirements

### Requirement: Paths are confined to the pane's directory

A `path` SHALL be relative to the pane's `cwd` with `/` separators; an empty
or omitted `path` names the `cwd` itself where a method allows it. The
bridge SHALL refuse with `path_outside_root`:

- an absolute path;
- any path containing a `..` segment or a NUL byte;
- any path whose real path, after resolving every symlink on the machine
  holding the file, is not the `cwd`'s real path or inside it;
- any path with a `.git` segment, before or after resolution.

A path that does not exist SHALL be `not_found`, after its nearest existing
ancestor has passed the same real-path check.

Every resolution SHALL happen on the machine holding the file: in the bridge
for a local host, in the reader for a host served over a socket. The bridge
SHALL NOT resolve a reader-backed host's paths itself, and SHALL surface the
reader's refusal unchanged.

#### Scenario: Dot-dot traversal

- **WHEN** a client calls `file.read` with `path: "../outside.txt"`
- **THEN** the bridge answers `path_outside_root`

#### Scenario: Absolute path

- **WHEN** a client calls `file.read` with an absolute path to a file that is
  inside the pane's directory
- **THEN** the bridge answers `path_outside_root`

#### Scenario: A symlink that escapes, on a remote host

- **WHEN** a remote pane's directory holds `link -> /some/dir/outside` and a
  client calls `file.read` with `path: "link/secret.txt"`
- **THEN** the reader resolves the real path on its own machine and refuses,
  the bridge answers `path_outside_root`, and nothing is read

#### Scenario: A symlink that stays inside

- **WHEN** the pane's directory holds `alias.md -> README.md`
- **THEN** `file.read` of `alias.md` returns `README.md`'s content

### Requirement: File methods are keyed by pane and advertised by capability

The bridge SHALL expose `repo.status`, `repo.tree`, `file.read` and
`repo.diff`. Every one SHALL take a `pane_id` and SHALL resolve the pane's
`cwd` from herdr at call time; no method SHALL accept a directory or an
absolute path from the client. A pane herdr no longer lists SHALL be
`pane_not_found`. `repo.tree` and `file.read` SHALL need only a `cwd`;
`repo.status` and `repo.diff` SHALL additionally need a git checkout
containing it and SHALL answer `no_checkout` when there is none.

A pane SHALL advertise `files_available` — the host is enabled, connected and
has a file source, and herdr reported a `cwd` — and `git_available` — the
source reported a checkout containing that `cwd`. `git_available` SHALL be
absent when that is unknown rather than guessed, and the git methods SHALL
answer `no_checkout` authoritatively on every call rather than trust either
flag.

`bridge.capabilities` SHALL carry `repoFiles` —
`{ statusPollIntervalMs, fileReadMaxBytes, diffMaxBytes, treeMaxEntries,
statusMaxEntries }` — when the bridge implements the four methods, and SHALL
omit the field entirely otherwise.

#### Scenario: A client probes before showing the panel

- **WHEN** the SPA calls `bridge.capabilities` against this bridge
- **THEN** the result carries `repoFiles` with a positive
  `statusPollIntervalMs` and the byte and entry caps

#### Scenario: The client cannot name a directory

- **WHEN** a client calls `repo.tree` with a `pane_id` and `path: "/etc"`
- **THEN** the bridge answers `path_outside_root` and lists nothing

#### Scenario: A pane outside any repository

- **WHEN** a pane's `cwd` is a scratch directory in no git checkout
- **THEN** the pane carries `files_available` and no `git_available`,
  `repo.tree` lists it, and `repo.status` answers `no_checkout`

### Requirement: Status is porcelain v2 for the checkout

`repo.status` SHALL return `{ checkout_path, branch, head, upstream?,
ahead?, behind?, entries, truncated }`, from
`git status --porcelain=v2 --branch -z --untracked-files=normal` run on the
machine the pane is on, in the pane's `cwd`, for the checkout containing it.
For a reader-backed host that run belongs to the reader; the bridge SHALL NOT
run `git` for a pane it does not serve locally. `branch`
SHALL be `null` when HEAD is detached and `head` SHALL be `null` when the
branch has no commit. Each entry SHALL be `{ path, kind, index, worktree,
orig_path? }` with `kind` one of `changed`, `renamed`, `unmerged`,
`untracked`, and `index`/`worktree` git's single-letter codes (`.` for
unmodified, `?` for untracked). At most `statusMaxEntries` entries SHALL be
returned, with `truncated: true` when more existed. The client SHALL poll
this method; the bridge SHALL NOT push status.

#### Scenario: A modified and an untracked file

- **WHEN** a tracked file is edited and a new file is created
- **THEN** `repo.status` lists the first as `changed` with `worktree: "M"`
  and the second as `untracked`

#### Scenario: Not a repository

- **WHEN** the pane's `cwd` is not in a git repository
- **THEN** the bridge answers `no_checkout`

#### Scenario: Git is missing on the host

- **WHEN** no `git` executable is on the PATH of the machine the pane is on
- **THEN** the bridge answers `git_unavailable`

### Requirement: The file panel's reach is documented

The documentation SHALL state which panes show files and which do not, in
operator terms: a connected host that is not `files: false` and has a file
source serves the panel for any pane with a working directory, the git views
additionally need a checkout, `files: false` is the operator's opt-out, and a
host with no reader says so and names what to install. What a remote host
needs — kanhrd present, a reader socket configured, the tunnel up — SHALL be
documented where the operator adds the host. Any documentation describing the
panel as local-only SHALL be corrected rather than annotated.

#### Scenario: An operator asks why a pane has no file panel

- **WHEN** a pane shows no file panel
- **THEN** the documented list of reasons covers the case, and each reason
  names what to change
