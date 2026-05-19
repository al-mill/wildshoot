import { config } from '@vue/test-utils'
import { vi } from 'vitest'

config.global.mocks = {}

vi.stubGlobal('defineNuxtConfig', () => ({}))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useRouter', () => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}))
vi.stubGlobal('useRoute', () => ({
  path: '/',
  params: {},
  query: {},
}))
vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('fetch', vi.fn())

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
