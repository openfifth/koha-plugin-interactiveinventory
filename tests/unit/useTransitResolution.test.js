import { describe, it, expect, vi } from 'vitest'
import { useTransitResolution } from '../../src/composables/useTransitResolution'

describe('useTransitResolution', () => {
  it('returns all required methods', () => {
    const composable = useTransitResolution()
    expect(typeof composable.getTransitInfo).toBe('function')
    expect(typeof composable.getTransitType).toBe('function')
    expect(typeof composable.getResolutionSettingKey).toBe('function')
    expect(typeof composable.getModalType).toBe('function')
    expect(typeof composable.handleItemIssue).toBe('function')
  })

  describe('getTransitInfo', () => {
    const { getTransitInfo } = useTransitResolution()

    it('returns default transit info when no transfer', () => {
      const item = {}
      const result = getTransitInfo(item)

      expect(result).toEqual({
        inTransit: false,
        type: null,
        reason: null,
        isHoldTransit: false,
        isReturnTransit: false,
        isManualTransit: false,
        from: null,
        to: null,
        date: null
      })
    })

    it('returns default transit info when transfer is null', () => {
      const item = { transfer: null }
      const result = getTransitInfo(item)

      expect(result.inTransit).toBe(false)
      expect(result.type).toBeNull()
    })

    it('returns transit info for Reserve (hold) transit', () => {
      const item = {
        transfer: {
          reason: 'Reserve',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-01'
        }
      }
      const result = getTransitInfo(item)

      expect(result.inTransit).toBe(true)
      expect(result.reason).toBe('Reserve')
      expect(result.type).toBe('hold')
      expect(result.isHoldTransit).toBe(true)
      expect(result.isReturnTransit).toBe(false)
      expect(result.from).toBe('LIB_A')
      expect(result.to).toBe('LIB_B')
      expect(result.date).toBe('2025-01-01')
    })

    it('returns transit info for ReturnToHome transit', () => {
      const item = {
        transfer: {
          reason: 'ReturnToHome',
          frombranch: 'LIB_B',
          tobranch: 'LIB_A',
          datesent: '2025-01-02'
        }
      }
      const result = getTransitInfo(item)

      expect(result.inTransit).toBe(true)
      expect(result.isReturnTransit).toBe(true)
      expect(result.isHoldTransit).toBe(false)
    })

    it('returns transit info for ReturnToHolding transit', () => {
      const item = {
        transfer: {
          reason: 'ReturnToHolding',
          frombranch: 'LIB_B',
          tobranch: 'LIB_A',
          datesent: '2025-01-02'
        }
      }
      const result = getTransitInfo(item)

      expect(result.isReturnTransit).toBe(true)
    })

    it('returns transit info for Manual transit', () => {
      const item = {
        transfer: {
          reason: 'Manual',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-03'
        }
      }
      const result = getTransitInfo(item)

      expect(result.isManualTransit).toBe(true)
      expect(result.type).toBe('manual')
    })

    it('returns transit info for StockrotationAdvance transit', () => {
      const item = {
        transfer: {
          reason: 'StockrotationAdvance',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-04'
        }
      }
      const result = getTransitInfo(item)

      expect(result.isStockrotationTransit).toBe(true)
      expect(result.type).toBe('stockrotation')
    })

    it('returns transit info for StockrotationRepatriation transit', () => {
      const item = {
        transfer: {
          reason: 'StockrotationRepatriation',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-04'
        }
      }
      const result = getTransitInfo(item)

      expect(result.isStockrotationTransit).toBe(true)
    })

    it('returns transit info for RotatingCollection transit', () => {
      const item = {
        transfer: {
          reason: 'RotatingCollection',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-05'
        }
      }
      const result = getTransitInfo(item)

      expect(result.isCollectionTransit).toBe(true)
      expect(result.type).toBe('collection')
    })

    it('returns transit info for Recall transit', () => {
      const item = {
        transfer: {
          reason: 'Recall',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-06'
        }
      }
      const result = getTransitInfo(item)

      expect(result.isRecallTransit).toBe(true)
      expect(result.type).toBe('recall')
    })
  })

  describe('getTransitType', () => {
    const { getTransitType } = useTransitResolution()

    it('returns "hold" for Reserve', () => {
      expect(getTransitType('Reserve')).toBe('hold')
    })

    it('returns "return" for ReturnToHome', () => {
      expect(getTransitType('ReturnToHome')).toBe('return')
    })

    it('returns "return" for ReturnToHolding', () => {
      expect(getTransitType('ReturnToHolding')).toBe('return')
    })

    it('returns "manual" for Manual', () => {
      expect(getTransitType('Manual')).toBe('manual')
    })

    it('returns "stockrotation" for StockrotationAdvance', () => {
      expect(getTransitType('StockrotationAdvance')).toBe('stockrotation')
    })

    it('returns "stockrotation" for StockrotationRepatriation', () => {
      expect(getTransitType('StockrotationRepatriation')).toBe('stockrotation')
    })

    it('returns "collection" for RotatingCollection', () => {
      expect(getTransitType('RotatingCollection')).toBe('collection')
    })

    it('returns "recall" for Recall', () => {
      expect(getTransitType('Recall')).toBe('recall')
    })

    it('returns "lost" for LostReserve', () => {
      expect(getTransitType('LostReserve')).toBe('lost')
    })

    it('returns "cancelled" for CancelReserve', () => {
      expect(getTransitType('CancelReserve')).toBe('cancelled')
    })

    it('returns "cancelled" for RecallCancellation', () => {
      expect(getTransitType('RecallCancellation')).toBe('cancelled')
    })

    it('returns "other" for unknown reason', () => {
      expect(getTransitType('UnknownReason')).toBe('other')
      expect(getTransitType('SomeOtherReason')).toBe('other')
    })

    it('returns "other" for null or undefined', () => {
      expect(getTransitType(null)).toBe('other')
      expect(getTransitType(undefined)).toBe('other')
    })
  })

  describe('getResolutionSettingKey', () => {
    const { getResolutionSettingKey } = useTransitResolution()

    it('returns "resolveLostItems" for lost issue', () => {
      expect(getResolutionSettingKey('lost')).toBe('resolveLostItems')
    })

    it('returns "resolveWithdrawnItems" for withdrawn issue', () => {
      expect(getResolutionSettingKey('withdrawn')).toBe('resolveWithdrawnItems')
    })

    it('returns "resolveInTransitItems" for transit issue', () => {
      expect(getResolutionSettingKey('transit')).toBe('resolveInTransitItems')
    })

    it('returns "resolveReturnClaims" for return_claim issue', () => {
      expect(getResolutionSettingKey('return_claim')).toBe('resolveReturnClaims')
    })

    it('returns undefined for unknown issue type', () => {
      expect(getResolutionSettingKey('unknown')).toBeUndefined()
      expect(getResolutionSettingKey('other')).toBeUndefined()
    })

    it('returns undefined for null or empty string', () => {
      expect(getResolutionSettingKey(null)).toBeUndefined()
      expect(getResolutionSettingKey('')).toBeUndefined()
    })
  })

  describe('getModalType', () => {
    const { getModalType } = useTransitResolution()

    it('returns "lost" for lost issue', () => {
      expect(getModalType('lost')).toBe('lost')
    })

    it('returns "withdrawn" for withdrawn issue', () => {
      expect(getModalType('withdrawn')).toBe('withdrawn')
    })

    it('returns "intransit" for transit issue', () => {
      expect(getModalType('transit')).toBe('intransit')
    })

    it('returns "returnclaim" for return_claim issue', () => {
      expect(getModalType('return_claim')).toBe('returnclaim')
    })

    it('returns undefined for unknown issue type', () => {
      expect(getModalType('unknown')).toBeUndefined()
      expect(getModalType('other')).toBeUndefined()
    })

    it('returns undefined for null or empty string', () => {
      expect(getModalType(null)).toBeUndefined()
      expect(getModalType('')).toBeUndefined()
    })
  })

  describe('handleItemIssue', () => {
    const { handleItemIssue } = useTransitResolution()

    it('opens modal when auto-resolve is disabled', async () => {
      const item = { id: 1 }
      const issue = { type: 'lost' }
      const statusAnalysis = {}
      const resolutionSettings = { resolveLostItems: false }
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(true)
      expect(openResolutionModalFn).toHaveBeenCalledWith(item, 'lost')
    })

    it('does not open modal when auto-resolve is enabled', async () => {
      const item = { id: 1 }
      const issue = { type: 'lost' }
      const statusAnalysis = {}
      const resolutionSettings = { resolveLostItems: true }
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(false)
      expect(openResolutionModalFn).not.toHaveBeenCalled()
    })

    it('opens modal for withdrawn items when auto-resolve disabled', async () => {
      const item = { id: 1 }
      const issue = { type: 'withdrawn' }
      const statusAnalysis = {}
      const resolutionSettings = { resolveWithdrawnItems: false }
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(true)
      expect(openResolutionModalFn).toHaveBeenCalledWith(item, 'withdrawn')
    })

    it('opens modal for transit items when auto-resolve disabled', async () => {
      const item = { id: 1 }
      const issue = { type: 'transit' }
      const statusAnalysis = {}
      const resolutionSettings = { resolveInTransitItems: false }
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(true)
      expect(openResolutionModalFn).toHaveBeenCalledWith(item, 'intransit')
    })

    it('opens modal for return claims when auto-resolve disabled', async () => {
      const item = { id: 1 }
      const issue = { type: 'return_claim' }
      const statusAnalysis = {}
      const resolutionSettings = { resolveReturnClaims: false }
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(true)
      expect(openResolutionModalFn).toHaveBeenCalledWith(item, 'returnclaim')
    })

    it('returns false for unknown issue type', async () => {
      const item = { id: 1 }
      const issue = { type: 'unknown' }
      const statusAnalysis = {}
      const resolutionSettings = {}
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(false)
      expect(openResolutionModalFn).not.toHaveBeenCalled()
    })

    it('returns false when resolution setting key is not found', async () => {
      const item = { id: 1 }
      const issue = { type: 'unknown_type' }
      const statusAnalysis = {}
      const resolutionSettings = {}
      const openResolutionModalFn = vi.fn()

      const result = await handleItemIssue(
        item,
        issue,
        statusAnalysis,
        resolutionSettings,
        openResolutionModalFn
      )

      expect(result).toBe(false)
      expect(openResolutionModalFn).not.toHaveBeenCalled()
    })

    it('handles multiple issues in sequence', async () => {
      const openResolutionModalFn = vi.fn()
      const resolutionSettings = {
        resolveLostItems: false,
        resolveWithdrawnItems: false,
        resolveInTransitItems: true
      }

      const item1 = { id: 1 }
      const issue1 = { type: 'lost' }
      const result1 = await handleItemIssue(
        item1,
        issue1,
        {},
        resolutionSettings,
        openResolutionModalFn
      )
      expect(result1).toBe(true)

      const item2 = { id: 2 }
      const issue2 = { type: 'transit' }
      const result2 = await handleItemIssue(
        item2,
        issue2,
        {},
        resolutionSettings,
        openResolutionModalFn
      )
      expect(result2).toBe(false)

      expect(openResolutionModalFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('integration: transit info and resolution', () => {
    const { getTransitInfo, getTransitType, getResolutionSettingKey, getModalType } =
      useTransitResolution()

    it('correctly identifies hold transit and maps to resolution', () => {
      const item = {
        transfer: {
          reason: 'Reserve',
          frombranch: 'LIB_A',
          tobranch: 'LIB_B',
          datesent: '2025-01-01'
        }
      }

      const transitInfo = getTransitInfo(item)
      expect(transitInfo.isHoldTransit).toBe(true)
      expect(transitInfo.type).toBe('hold')
    })

    it('correctly identifies return transit and maps to resolution', () => {
      const item = {
        transfer: {
          reason: 'ReturnToHome',
          frombranch: 'LIB_B',
          tobranch: 'LIB_A',
          datesent: '2025-01-02'
        }
      }

      const transitInfo = getTransitInfo(item)
      expect(transitInfo.isReturnTransit).toBe(true)
      expect(transitInfo.type).toBe('return')
    })

    it('maps all transit types to correct modal types', () => {
      const transitReasons = [
        { reason: 'Reserve', expectedType: 'hold' },
        { reason: 'ReturnToHome', expectedType: 'return' },
        { reason: 'Manual', expectedType: 'manual' },
        { reason: 'StockrotationAdvance', expectedType: 'stockrotation' },
        { reason: 'RotatingCollection', expectedType: 'collection' },
        { reason: 'Recall', expectedType: 'recall' }
      ]

      transitReasons.forEach(({ reason, expectedType }) => {
        const type = getTransitType(reason)
        expect(type).toBe(expectedType)
      })
    })
  })
})
