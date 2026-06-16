/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  test: {
    // Test environment
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./test/setup.ts'],

    // Include patterns
    include: [
      '**/__tests__/**/*.{js,jsx,ts,tsx,vue}',
      '**/*.{test,spec}.{js,jsx,ts,tsx,vue}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      '.nuxt',
      'dist',
      '.output',
      'cdk.out',
      'coverage',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/*.{js,jsx,ts,tsx,vue}'],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/.nuxt/**',
        '**/dist/**',
        '**/.output/**',
        '**/cdk.out/**',
        '**/coverage/**',
        '**/test/**',
        'vitest.config.ts',
        'nuxt.config.ts',
      ],
    },

    passWithNoTests: true,

    // Global test configuration
    globals: true,
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '~': resolve(__dirname, '.'),
      '#app': resolve(__dirname, 'node_modules/nuxt/dist/app/index.mjs'),
    },
  },

  // Define global variables for compatibility
  define: {
    global: 'globalThis',
  },
})
