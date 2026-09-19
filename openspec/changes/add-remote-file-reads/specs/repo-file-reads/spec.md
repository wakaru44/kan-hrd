## ADDED Requirements

### Requirement: Files are read from the host's own filesystem

The bridge SHALL read a pane's files from the machine that pane's host runs
on, chosen by that host's configured transport: a local host's files SHALL be
read from the bridge's filesystem, and an ssh host's SHALL be read over that
host's established connection. The bridge SHALL NOT infer which machine a
path belongs to by testing whether it exists locally.

File access for a pane SHALL be refused when, and only when, the host is
configured `files: false` (`files_disabled`), the host is not connected
(`host_unavailable`), or herdr reported no `cwd` for the pane
(`no_working_directory`). There SHALL be no `files_not_local` refusal.

A remote read SHALL be bounded: at most one file session per host with
requests queued, a per-request timeout, and the same byte and entry caps as a
local read. A read that times out SHALL fail that request alone and SHALL
NOT close the host's connection.

#### Scenario: A pane on a remote host

- **WHEN** a pane on a connected ssh host reports a `cwd` that does not exist
  on the bridge's machine
- **THEN** `repo.tree` lists that directory from the remote machine

#### Scenario: A local path that coincides with a remote one

- **WHEN** a pane on an ssh host reports a `cwd` that also exists on the
  bridge's own machine
- **THEN** the bridge reads the remote machine's copy, never its own

#### Scenario: The host is down

- **WHEN** a remote host's transport is disconnected and a client calls
  `file.read`
- **THEN** the bridge answers `host_unavailable` and reads nothing

#### Scenario: The operator disables a host

- **WHEN** a host is configured with `files: false`
- **THEN** every file method for its panes answers `files_disabled`

#### Scenario: A slow link

- **WHEN** a remote `file.read` exceeds the per-request timeout
- **THEN** that request fails with `read_timeout`, the host stays connected,
  and a later request succeeds

## REMOVED Requirements

### Requirement: Files are served only from the bridge's own machine

**Reason**: The gate guessed machine identity by stat-ing paths locally,
which it could not do correctly — its own scenarios were about the wrong
machine's checkout being served. With the transport declared per host
(`add-ssh-host-transport`), the bridge knows which machine a pane's files
live on and reads them there. The operator's `files: false` switch survives,
in "Files are read from the host's own filesystem".

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
ancestor has passed the same real-path check. For a remote host every
resolution SHALL happen on that host, so a symlink SHALL be followed on the
machine it lives on.

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
- **THEN** the real path is resolved on the remote machine, the bridge
  answers `path_outside_root`, and reads nothing

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

A pane SHALL advertise `files_available` — the host is enabled and connected
and herdr reported a `cwd` — and `git_available` — a checkout containing that
`cwd` exists on the host. The methods SHALL re-check on every call rather
than trust either flag.

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
pane's host in the pane's `cwd`, for the checkout containing it. `branch`
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

- **WHEN** no `git` executable is on the PATH of the machine the pane's host
  runs on
- **THEN** the bridge answers `git_unavailable`
