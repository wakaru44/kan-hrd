import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TunnelHost } from './config.js';

/**
 * The argv for one host's forward. Pure: no spawning, no filesystem.
 *
 * Two flags are load-bearing and were measured, not assumed (ADR-0006):
 * `StreamLocalBindUnlink=yes`, because a dead forward leaves its socket file
 * behind and the next bind fails with "address already in use"; and
 * `BatchMode=yes`, so an encrypted key with no agent fails fast instead of
 * sitting on a passphrase prompt. `StrictHostKeyChecking` is never touched —
 * keys, `~/.ssh/config`, `known_hosts`, `ProxyJump` and the agent are the
 * operator's ssh client's business, and this command only invokes it.
 */
export function buildSshArgv(host: TunnelHost): string[] {
  return [
    '-nNT',
    '-o',
    'BatchMode=yes',
    '-o',
    'StreamLocalBindUnlink=yes',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=15',
    '-o',
    'ServerAliveCountMax=3',
    '-L',
    `${host.socket}:${host.remoteSocket}`,
    host.sshTarget,
  ];
}

/**
 * Where the pid and ssh's own stderr live between invocations — this is how
 * `down` finds what `up` started, and how `status` can name a last error.
 */
export function stateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.KANHRD_TUNNEL_STATE_DIR;
  if (override !== undefined && override !== '') return resolve(override);
  const xdg = env.XDG_STATE_HOME;
  if (xdg !== undefined && xdg !== '') return join(resolve(xdg), 'kanhrd', 'tunnel');
  return join(homedir(), '.local', 'state', 'kanhrd', 'tunnel');
}

export function pidFile(hostName: string, env?: NodeJS.ProcessEnv): string {
  return join(stateDir(env), `${hostName}.pid`);
}

export function logFile(hostName: string, env?: NodeJS.ProcessEnv): string {
  return join(stateDir(env), `${hostName}.log`);
}
