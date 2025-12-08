import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/review/**', 'node'],
      ['tests/spaces/**', 'node'],
      ['tests/amenities/**', 'node'],
      ['tests/availability/**', 'node'],
      ['tests/area/**', 'node'],
      ['tests/rate/**', 'node'],
      ['tests/bookmarks/**', 'node'],
      ['tests/user/**', 'node'],
      ['tests/comprehensive-test-cases/**', 'node'],
      ['tests/integration-testing/**', 'node'],
    ],
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'tests/coverage',
      reporter: ['text', 'html'],
    },
  },
  resolve: { alias: { '@': resolve(__dirname, './src'), }, },
});
