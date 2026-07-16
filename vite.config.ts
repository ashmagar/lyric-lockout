import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    css: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
