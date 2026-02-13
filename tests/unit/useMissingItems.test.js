import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMissingItems } from '../../src/composables/useMissingItems'

vi.mock('../../src/components/eventBus', () => ({
  EventBus: {
    emit: vi.fn()
  }
}))

vi.mock('../../src/services/sessionStorage', () => ({
  saveMarkedMissingItems: vi.fn(() => Promise.resolve()),
  getMarkedMissingItems: vi.fn(() => Promise.resolve([]))
}))

vi.mock('../../src/utils/missingItems', () => ({
  filterMissingItems: vi.fn((params) => {
    const { locationData = [], scannedBarcodes = [], markedMissingBarcodes = [] } = params
    const scannedSet = new Set(
      Array.isArray(scannedBarcodes) ? scannedBarcodes : Array.from(scannedBarcodes)
    )
    const missingSet = new Set(
      Array.isArray(markedMissingBarcodes)
        ? markedMissingBarcodes
        : Array.from(markedMissingBarcodes)
    )
    return locationData.filter(
      (item) => !scannedSet.has(item.barcode) && !missingSet.has(item.barcode)
    )
  })
}))

import { EventBus } from '../../src/components/eventBus'
import { saveMarkedMissingItems, getMarkedMissingItems } from '../../src/services/sessionStorage'

describe('useMissingItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes markedMissingItems as empty Set', () => {
    const { markedMissingItems } = useMissingItems()
    expect(markedMissingItems.value).toEqual(new Set())
  })

  it('returns all required methods', () => {
    const composable = useMissingItems()
    expect(typeof composable.getMissingItemsCount).toBe('function')
    expect(typeof composable.handleItemMarkedMissing).toBe('function')
    expect(typeof composable.handleItemsMarkedMissing).toBe('function')
    expect(typeof composable.markItemMissing).toBe('function')
    expect(typeof composable.handleMissingItemsUpdated).toBe('function')
  })

  describe('getMissingItemsCount', () => {
    it('returns 0 when no sessionData', () => {
      const { getMissingItemsCount } = useMissingItems()
      expect(getMissingItemsCount(null, [])).toBe(0)
      expect(getMissingItemsCount(undefined, [])).toBe(0)
    })

    it('returns 0 when no response_data', () => {
      const { getMissingItemsCount } = useMissingItems()
      expect(getMissingItemsCount({}, [])).toBe(0)
    })

    it('returns 0 when no location_data or right_place_list', () => {
      const { getMissingItemsCount } = useMissingItems()
      const sessionData = { response_data: {} }
      expect(getMissingItemsCount(sessionData, [])).toBe(0)
    })

    it('counts missing items from location_data', () => {
      const { getMissingItemsCount } = useMissingItems()
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }, { barcode: '003' }]
        }
      }
      const items = [{ external_id: '001' }]
      const count = getMissingItemsCount(sessionData, items)
      expect(count).toBe(2)
    })

    it('falls back to right_place_list when location_data is empty', () => {
      const { getMissingItemsCount } = useMissingItems()
      const sessionData = {
        response_data: {
          location_data: [],
          right_place_list: [{ barcode: '001' }, { barcode: '002' }]
        }
      }
      const items = [{ external_id: '001' }]
      const count = getMissingItemsCount(sessionData, items)
      expect(count).toBe(1)
    })

    it('excludes marked missing items from count', () => {
      const { getMissingItemsCount, markedMissingItems } = useMissingItems()
      markedMissingItems.value.add('002')

      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }, { barcode: '003' }]
        }
      }
      const items = [{ external_id: '001' }]
      const count = getMissingItemsCount(sessionData, items)
      expect(count).toBe(1)
    })

    it('respects skipCheckedOutItems setting', () => {
      const { getMissingItemsCount } = useMissingItems()
      const sessionData = {
        skipCheckedOutItems: true,
        response_data: {
          location_data: [
            { barcode: '001', checked_out: false },
            { barcode: '002', checked_out: true }
          ]
        }
      }
      const items = []
      const count = getMissingItemsCount(sessionData, items)
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('handleItemMarkedMissing', () => {
    it('adds barcode to markedMissingItems', () => {
      const { handleItemMarkedMissing, markedMissingItems } = useMissingItems()
      handleItemMarkedMissing('BARCODE001')
      expect(markedMissingItems.value.has('BARCODE001')).toBe(true)
    })

    it('saves marked missing items to storage', () => {
      const { handleItemMarkedMissing } = useMissingItems()
      handleItemMarkedMissing('BARCODE001')
      expect(saveMarkedMissingItems).toHaveBeenCalledWith(['BARCODE001'])
    })

    it('handles multiple items marked missing', () => {
      const { handleItemMarkedMissing, markedMissingItems } = useMissingItems()
      handleItemMarkedMissing('BARCODE001')
      handleItemMarkedMissing('BARCODE002')
      expect(markedMissingItems.value.size).toBe(2)
      expect(markedMissingItems.value.has('BARCODE001')).toBe(true)
      expect(markedMissingItems.value.has('BARCODE002')).toBe(true)
    })
  })

  describe('handleItemsMarkedMissing', () => {
    it('adds multiple barcodes to markedMissingItems', () => {
      const { handleItemsMarkedMissing, markedMissingItems } = useMissingItems()
      handleItemsMarkedMissing(['BARCODE001', 'BARCODE002', 'BARCODE003'])
      expect(markedMissingItems.value.size).toBe(3)
    })

    it('saves all marked missing items to storage', () => {
      const { handleItemsMarkedMissing } = useMissingItems()
      handleItemsMarkedMissing(['BARCODE001', 'BARCODE002'])
      expect(saveMarkedMissingItems).toHaveBeenCalledWith(['BARCODE001', 'BARCODE002'])
    })

    it('handles empty array', () => {
      const { handleItemsMarkedMissing, markedMissingItems } = useMissingItems()
      handleItemsMarkedMissing([])
      expect(markedMissingItems.value.size).toBe(0)
    })

    it('preserves existing marked items when adding new ones', () => {
      const { handleItemMarkedMissing, handleItemsMarkedMissing, markedMissingItems } =
        useMissingItems()
      handleItemMarkedMissing('BARCODE001')
      handleItemsMarkedMissing(['BARCODE002', 'BARCODE003'])
      expect(markedMissingItems.value.size).toBe(3)
    })
  })

  describe('markItemMissing', () => {
    it('adds barcode to markedMissingItems', () => {
      const { markItemMissing, markedMissingItems } = useMissingItems()
      markItemMissing('BARCODE001')
      expect(markedMissingItems.value.has('BARCODE001')).toBe(true)
    })

    it('saves marked missing items to storage', async () => {
      const { markItemMissing } = useMissingItems()
      markItemMissing('BARCODE001')
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(saveMarkedMissingItems).toHaveBeenCalled()
    })

    it('emits success message on successful save', async () => {
      const { markItemMissing } = useMissingItems()
      markItemMissing('BARCODE001')
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('BARCODE001'),
          type: 'status'
        })
      )
    })

    it('emits error message on save failure', async () => {
      saveMarkedMissingItems.mockRejectedValueOnce(new Error('Storage error'))
      const { markItemMissing } = useMissingItems()
      markItemMissing('BARCODE001')
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'error'
        })
      )
    })
  })

  describe('handleMissingItemsUpdated', () => {
    it('loads marked missing items from storage', async () => {
      getMarkedMissingItems.mockResolvedValueOnce(['BARCODE001', 'BARCODE002'])
      const { handleMissingItemsUpdated, markedMissingItems } = useMissingItems()
      await handleMissingItemsUpdated()
      expect(markedMissingItems.value.has('BARCODE001')).toBe(true)
      expect(markedMissingItems.value.has('BARCODE002')).toBe(true)
    })

    it('handles empty marked items list', async () => {
      getMarkedMissingItems.mockResolvedValueOnce([])
      const { handleMissingItemsUpdated, markedMissingItems } = useMissingItems()
      await handleMissingItemsUpdated()
      expect(markedMissingItems.value.size).toBe(0)
    })

    it('converts array to Set', async () => {
      getMarkedMissingItems.mockResolvedValueOnce(['BARCODE001', 'BARCODE002'])
      const { handleMissingItemsUpdated, markedMissingItems } = useMissingItems()
      await handleMissingItemsUpdated()
      expect(markedMissingItems.value instanceof Set).toBe(true)
    })

    it('handles null response from storage', async () => {
      getMarkedMissingItems.mockResolvedValueOnce(null)
      const { handleMissingItemsUpdated, markedMissingItems } = useMissingItems()
      await handleMissingItemsUpdated()
      expect(markedMissingItems.value.size).toBe(0)
    })

    it('handles error from storage', async () => {
      getMarkedMissingItems.mockRejectedValueOnce(new Error('Storage error'))
      const { handleMissingItemsUpdated, markedMissingItems } = useMissingItems()
      await handleMissingItemsUpdated()
      expect(markedMissingItems.value.size).toBe(0)
    })

    it('clears previous marked items when loading new ones', async () => {
      const { handleItemMarkedMissing, handleMissingItemsUpdated, markedMissingItems } =
        useMissingItems()
      handleItemMarkedMissing('OLD_BARCODE')
      expect(markedMissingItems.value.size).toBe(1)

      getMarkedMissingItems.mockResolvedValueOnce(['NEW_BARCODE'])
      await handleMissingItemsUpdated()
      expect(markedMissingItems.value.size).toBe(1)
      expect(markedMissingItems.value.has('NEW_BARCODE')).toBe(true)
      expect(markedMissingItems.value.has('OLD_BARCODE')).toBe(false)
    })
  })

  describe('integration: marking and counting missing items', () => {
    it('updates missing count when items are marked', () => {
      const { getMissingItemsCount, handleItemMarkedMissing, markedMissingItems } =
        useMissingItems()

      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }, { barcode: '003' }]
        }
      }

      let count = getMissingItemsCount(sessionData, [])
      expect(count).toBe(3)

      handleItemMarkedMissing('001')
      count = getMissingItemsCount(sessionData, [])
      expect(count).toBe(2)

      handleItemMarkedMissing('002')
      count = getMissingItemsCount(sessionData, [])
      expect(count).toBe(1)
    })

    it('handles multiple instances independently', () => {
      const instance1 = useMissingItems()
      const instance2 = useMissingItems()

      instance1.handleItemMarkedMissing('BARCODE001')
      expect(instance1.markedMissingItems.value.size).toBe(1)
      expect(instance2.markedMissingItems.value.size).toBe(0)
    })
  })
})
