import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * A host the tunnel command can act on: one that declares an ssh target and
 * the herdr socket path on the far machine. `socket` is the local path the
 * forward lands on — the same string the bridge connects to.
 */
export interface TunnelHost {
  name: string;
  socket: string;
  sshTarget: string;
  /** Path on the REMOTE machine. Never resolved against this filesystem. */
  remoteSocket: string;
}

/** A host entry as the config file spells it (snake_case, like every key). */
interface RawHostEntry {
  name?: string;
  socket?: string;
  ssh_target?: string;
  remote_socket?: string;
}

interface RawConfigFile {
  hosts?: RawHostEntry[];
}

export const DEFAULT_CONFIG_PATH = 'kanhrd.config.yaml';

/**
 * A local `~` belongs to this machine and is expanded; a remote path is not
 * passed through here. Mirrors `expandHome` in the bridge's config parser —
 * duplicated rather than imported, because the bridge's `loadConfig` also
 * enforces bind and origin rules that are none of this command's business.
 */
export function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return resolve(homedir(), path.slice(2));
  return path;
}

export class ConfigError extends Error {}

/** What the config holds: the tunnelled hosts, and the names of the rest. */
export interface TunnelInventory {
  hosts: TunnelHost[];
  /** Configured hosts with no ssh target — local, and not ours to forward. */
  localNames: string[];
}

/**
 * Reads the bridge's own configuration file and returns the hosts that carry
 * an ssh target. A host with no ssh target is local and is skipped silently:
 * there is no second inventory of hosts.
 */
export function loadTunnelHosts(configPath: string = DEFAULT_CONFIG_PATH): TunnelInventory {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigError(`no config at ${configPath}`);
    }
    throw err;
  }

  const parsed = (parseYaml(raw) ?? {}) as RawConfigFile;
  const hosts: TunnelHost[] = [];
  const localNames: string[] = [];
  for (const entry of parsed.hosts ?? []) {
    const name = entry.name;
    if (name === undefined || name === '') throw new ConfigError('a host has no name');
    if (entry.ssh_target === undefined) {
      localNames.push(name);
      continue;
    }
    if (entry.socket === undefined) {
      throw new ConfigError(`host "${name}": socket is required`);
    }
    if (entry.remote_socket === undefined) {
      throw new ConfigError(`host "${name}": remote_socket is required alongside ssh_target`);
    }
    hosts.push({
      name,
      socket: expandHome(entry.socket),
      sshTarget: entry.ssh_target,
      remoteSocket: entry.remote_socket,
    });
  }
  return { hosts, localNames };
}

/** The hosts named on the command line, in the order given. */
export function selectHosts(inventory: TunnelInventory, names: string[]): TunnelHost[] {
  if (names.length === 0) return inventory.hosts;
  return names.map((name) => {
    const host = inventory.hosts.find((candidate) => candidate.name === name);
    if (host !== undefined) return host;
    if (inventory.localNames.includes(name)) {
      throw new ConfigError(`host "${name}" is local: it has no ssh_target to forward`);
    }
    throw new ConfigError(`no host named "${name}" in the config`);
  });
}
