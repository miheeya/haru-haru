import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      // Redirect electron to a stub so CJS require('electron') doesn't fail
      'electron': path.resolve(__dirname, 'test/__mocks__/electron.cjs'),
    },
  },
});
