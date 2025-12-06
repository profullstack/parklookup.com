import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', '.next', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '.next/',
        'coverage/',
        '**/*.config.js',
        '**/layout.jsx',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
      '@/lib': path.resolve(import.meta.dirname, './lib'),
      '@/components': path.resolve(import.meta.dirname, './components'),
      '@/app': path.resolve(import.meta.dirname, './app'),
    },
  },
});