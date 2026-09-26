import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';

/**
 * What a probe found. Health is decided by connecting and getting an answer,
 * never by the socket file existing — a file left behind by a dead forward
 * looks exactly like a working one on disk.
 */
export type Health =
  | { state: 'up' }
  /** Nothing at the path: the forward was never brought up. */
  | { state: 'missing' }
  /** The file is there, nothing listens: the forward died behind it. */
  | { state: 'stale'; detail: string }
  /** The forward answers, herdr does not: the remote path is wrong. */
  | { state: 'silent'; detail: string };

/**
 * One read-only herdr request over the local socket. herdr answers one line
 * per connection and closes, so any line back — even an error line — proves
 * a herdr is listening on the far end of the forward.
 */
const PROBE_LINE = `${JSON.stringify({ id: '00000000-0000-0000-0000-000000000000', method: 'pane.list', params: {} })}\n`;

export function probe(socketPath: string, timeoutMs = 3000): Promise<Health> {
  if (!existsSync(socketPath)) return Promise.resolve({ state: 'missing' });

  return new Promise<Health>((resolveHealth) => {
    const socket = createConnection(socketPath);
    let settled = false;
    const finish = (health: Health): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolveHealth(health);
    };

    const timer = setTimeout(() => {
      finish({ state: 'silent', detail: `no answer within ${timeoutMs}ms` });
    }, timeoutMs);

    socket.once('connect', () => {
      // A fresh id per probe, so a herdr that logs requests logs distinct ones.
      socket.write(PROBE_LINE.replace('00000000-0000-0000-0000-000000000000', randomUUID()));
    });
    socket.once('data', () => {
      finish({ state: 'up' });
    });
    socket.once('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ECONNREFUSED' || code === 'ENOENT') {
        finish({ state: 'stale', detail: code.toLowerCase() });
        return;
      }
      finish({ state: 'silent', detail: err.message });
    });
    socket.once('close', () => {
      finish({ state: 'silent', detail: 'the channel closed before an answer' });
    });
  });
}
