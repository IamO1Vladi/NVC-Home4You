import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees and reset mocks between tests so they stay isolated.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
