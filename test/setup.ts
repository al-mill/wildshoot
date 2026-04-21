// Test setup for Vue components with Vitest
import { config } from '@vue/test-utils';
import { vi } from 'vitest';

// Global test configuration
config.global.mocks = {
  // Add global mocks here if needed
};

// Mock Nuxt composables
global.defineNuxtConfig = () => ({});
global.navigateTo = vi.fn();
global.useRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
});

global.useRoute = () => ({
  path: '/',
  params: {},
  query: {},
});

global.useSeoMeta = vi.fn();
global.useHead = vi.fn();

// Mock fetch for testing
global.fetch = vi.fn();

// Setup DOM APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
