import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSessionManagement } from '../../src/composables/useSessionManagement'

vi.mock('../../src/components/eventBus', () => ({
  EventBus: {
    emit: vi.fn()
  }
}))

vi.mock('../../src/services/sessionStorage', () => ({
  saveSession: vi.fn(() => Promise.resolve()),
  getSession: vi.fn(() => Promise.resolve(null)),
  saveItems: vi.fn(() => Promise.resolve()),
  getItems: vi.fn(() => Promise.resolve(null)),
  clearSession: vi.fn(() => Promise.resolve()),
  saveMarkedMissingItems: vi.fn(() => Promise.resolve()),
  getMarkedMissingItems: vi.fn(() => Promise.resolve([])),
  isSessionActive: vi.fn(() => false)
}))

import { EventBus } from '../../src/components/eventBus'
import {
  saveSession,
  getSession,
  saveItems,
  getItems,
  clearSession,
  saveMarkedMissingItems,
  getMarkedMissingItems,
  isSessionActive
} from '../../src/services/sessionStorage'

describe('useSessionManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all required methods', () => {
    const composable = useSessionManagement()
    expect(typeof composable.checkForExistingSession).toBe('function')
    expect(typeof composable.initiateInventorySession).toBe('function')
    expect(typeof composable.completeSession).toBe('function')
  })

  describe('checkForExistingSession', () => {
    it('calls loadFormDataFn when no active session', () => {
      isSessionActive.mockReturnValue(false)
      const { checkForExistingSession } = useSessionManagement()
      const loadFormDataFn = vi.fn()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter: vi.fn(),
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn
      })

      expect(loadFormDataFn).toHaveBeenCalled()
    })

    it('restores session when active session exists', async () => {
      isSessionActive.mockReturnValue(true)
      const savedSessionData = { id: 1, name: 'Test Session' }
      getSession.mockResolvedValue(savedSessionData)
      getItems.mockResolvedValue([])
      getMarkedMissingItems.mockResolvedValue([])

      const { checkForExistingSession } = useSessionManagement()
      const sessionDataSetter = vi.fn()
      const sessionStartedSetter = vi.fn()

      checkForExistingSession({
        sessionDataSetter,
        sessionStartedSetter,
        itemsSetter: vi.fn(),
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(sessionDataSetter).toHaveBeenCalledWith(savedSessionData)
      expect(sessionStartedSetter).toHaveBeenCalledWith(true)
    })

    it('restores items when available', async () => {
      isSessionActive.mockReturnValue(true)
      getSession.mockResolvedValue({ id: 1 })
      const savedItems = [{ id: 1 }, { id: 2 }]
      getItems.mockResolvedValue(savedItems)
      getMarkedMissingItems.mockResolvedValue([])

      const { checkForExistingSession } = useSessionManagement()
      const itemsSetter = vi.fn()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter,
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(itemsSetter).toHaveBeenCalledWith(savedItems)
    })

    it('restores marked missing items', async () => {
      isSessionActive.mockReturnValue(true)
      getSession.mockResolvedValue({ id: 1 })
      getItems.mockResolvedValue([])
      const savedMarkedItems = ['BARCODE001', 'BARCODE002']
      getMarkedMissingItems.mockResolvedValue(savedMarkedItems)

      const { checkForExistingSession } = useSessionManagement()
      const markedMissingItemsSetter = vi.fn()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter: vi.fn(),
        markedMissingItemsSetter,
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(markedMissingItemsSetter).toHaveBeenCalledWith(new Set(savedMarkedItems))
    })

    it('calls updateHighestCallNumberFn when items are restored', async () => {
      isSessionActive.mockReturnValue(true)
      getSession.mockResolvedValue({ id: 1 })
      getItems.mockResolvedValue([{ id: 1 }])
      getMarkedMissingItems.mockResolvedValue([])

      const { checkForExistingSession } = useSessionManagement()
      const updateHighestCallNumberFn = vi.fn()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter: vi.fn(),
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn,
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(updateHighestCallNumberFn).toHaveBeenCalled()
    })

    it('calls focusBarcodeInputFn after session is restored', async () => {
      isSessionActive.mockReturnValue(true)
      getSession.mockResolvedValue({ id: 1 })
      getItems.mockResolvedValue([])
      getMarkedMissingItems.mockResolvedValue([])

      const { checkForExistingSession } = useSessionManagement()
      const focusBarcodeInputFn = vi.fn()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter: vi.fn(),
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn,
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(focusBarcodeInputFn).toHaveBeenCalled()
    })

    it('emits success message when session is restored', async () => {
      isSessionActive.mockReturnValue(true)
      getSession.mockResolvedValue({ id: 1 })
      getItems.mockResolvedValue([])
      getMarkedMissingItems.mockResolvedValue([])

      const { checkForExistingSession } = useSessionManagement()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter: vi.fn(),
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: 'Session restored successfully',
          type: 'status'
        })
      )
    })

    it('handles error when restoring session', async () => {
      isSessionActive.mockReturnValue(true)
      getSession.mockRejectedValue(new Error('Storage error'))

      const { checkForExistingSession } = useSessionManagement()

      checkForExistingSession({
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        itemsSetter: vi.fn(),
        markedMissingItemsSetter: vi.fn(),
        updateHighestCallNumberFn: vi.fn(),
        focusBarcodeInputFn: vi.fn(),
        loadFormDataFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'error'
        })
      )
    })
  })

  describe('initiateInventorySession', () => {
    it('sets session data and started flag', () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ location_data: [], right_place_list: [] }))
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1, selectedLibraryId: 'LIB_A' }
      const sessionDataSetter = vi.fn()
      const sessionStartedSetter = vi.fn()

      initiateInventorySession(sessionData, {
        sessionDataSetter,
        sessionStartedSetter,
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      expect(sessionDataSetter).toHaveBeenCalledWith(sessionData)
      expect(sessionStartedSetter).toHaveBeenCalledWith(true)
    })

    it('makes fetch request to start session', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ location_data: [], right_place_list: [] }))
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1 }

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(global.fetch).toHaveBeenCalled()
    })

    it('saves session data after successful fetch', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ location_data: [], right_place_list: [] }))
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1 }

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(saveSession).toHaveBeenCalled()
    })

    it('saves empty items list after session start', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ location_data: [], right_place_list: [] }))
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1 }
      const itemsSetter = vi.fn()

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter,
        focusBarcodeInputFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(itemsSetter).toHaveBeenCalledWith([])
      expect(saveItems).toHaveBeenCalledWith([])
    })

    it('sets resolution settings from session data', () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ location_data: [], right_place_list: [] }))
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = {
        id: 1,
        resolutionSettings: {
          resolveLostItems: true,
          resolveWithdrawnItems: false
        }
      }
      const resolutionSettingsSetter = vi.fn()

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter,
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      expect(resolutionSettingsSetter).toHaveBeenCalledWith(
        expect.objectContaining({
          resolveLostItems: true,
          resolveWithdrawnItems: false
        })
      )
    })

    it('handles fetch error', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1 }
      const sessionStartedSetter = vi.fn()

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter,
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(sessionStartedSetter).toHaveBeenCalledWith(false)
      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'error'
        })
      )
    })

    it('handles non-OK response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            get: () => 'application/json'
          },
          json: () => Promise.resolve({ error: 'Server error' })
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1 }

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'error'
        })
      )
    })

    it('emits status messages during session initialization', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ location_data: [], right_place_list: [] }))
        })
      )

      const { initiateInventorySession } = useSessionManagement()
      const sessionData = { id: 1, shelvingLocation: 'FICTION' }

      initiateInventorySession(sessionData, {
        sessionDataSetter: vi.fn(),
        sessionStartedSetter: vi.fn(),
        sessionInitializingSetter: vi.fn(),
        manualResolutionEnabledSetter: vi.fn(),
        resolutionSettingsSetter: vi.fn(),
        itemsSetter: vi.fn(),
        focusBarcodeInputFn: vi.fn()
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'status'
        })
      )
    })
  })

  describe('completeSession', () => {
    it('saves session data', () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set()

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      expect(saveSession).toHaveBeenCalledWith(sessionData)
    })

    it('saves items', async () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = [{ id: 1 }]
      const markedMissingItems = new Set()

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(saveItems).toHaveBeenCalledWith(items)
    })

    it('saves marked missing items when present', async () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set(['BARCODE001', 'BARCODE002'])

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(saveMarkedMissingItems).toHaveBeenCalledWith(['BARCODE001', 'BARCODE002'])
    })

    it('does not save marked missing items when empty', async () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set()

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(saveMarkedMissingItems).not.toHaveBeenCalled()
    })

    it('calls resetStateFn after saving', async () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set()
      const resetStateFn = vi.fn()

      completeSession(sessionData, items, markedMissingItems, resetStateFn)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(resetStateFn).toHaveBeenCalled()
    })

    it('clears session after reset', async () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set()

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(clearSession).toHaveBeenCalled()
    })

    it('emits success message when session is completed', async () => {
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set()

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: 'Inventory session ended',
          type: 'status'
        })
      )
    })

    it('handles error during session completion', async () => {
      saveSession.mockRejectedValueOnce(new Error('Save error'))
      const { completeSession } = useSessionManagement()
      const sessionData = { id: 1 }
      const items = []
      const markedMissingItems = new Set()

      completeSession(sessionData, items, markedMissingItems, vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'error'
        })
      )
    })
  })
})
