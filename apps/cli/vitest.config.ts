import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the `kanhrd` CLI. They never open a real ssh connection:
 * the tunnel suite puts a fake `ssh` from `test-fixtures/` on `PATH` and
 * every socket it touches lives in a temp dir it made itself.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 20000,
  },
});
