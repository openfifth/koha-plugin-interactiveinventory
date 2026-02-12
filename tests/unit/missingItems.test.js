import { describe, it, expect } from 'vitest'
import { filterMissingItems } from '../../src/utils/missingItems'

// Helper to create test items
function makeItem(barcode, overrides = {}) {
  return {
    barcode,
    checked_out: false,
    checked_out_date: null,
    in_transit: false,
    homebranch: 'LIB_A',
    holdingbranch: 'LIB_A',
    ...overrides
  }
}

describe('filterMissingItems', () => {
  const baseItems = [
    makeItem('001'),
    makeItem('002'),
    makeItem('003'),
    makeItem('004'),
    makeItem('005')
  ]

  it('returns all items when nothing is scanned or marked', () => {
    const result = filterMissingItems({ locationData: baseItems })
    expect(result).toHaveLength(5)
  })

  it('returns empty array when no location data or right place list', () => {
    const result = filterMissingItems({})
    expect(result).toEqual([])
  })

  it('falls back to rightPlaceList when locationData is empty', () => {
    const result = filterMissingItems({
      locationData: [],
      rightPlaceList: baseItems
    })
    expect(result).toHaveLength(5)
  })

  it('prefers locationData over rightPlaceList when both are present', () => {
    const result = filterMissingItems({
      locationData: [makeItem('LOC1')],
      rightPlaceList: [makeItem('RPL1'), makeItem('RPL2')]
    })
    expect(result).toHaveLength(1)
    expect(result[0].barcode).toBe('LOC1')
  })

  describe('scanned items filtering', () => {
    it('excludes scanned barcodes (Array)', () => {
      const result = filterMissingItems({
        locationData: baseItems,
        scannedBarcodes: ['001', '003']
      })
      expect(result).toHaveLength(3)
      expect(result.map((i) => i.barcode)).toEqual(['002', '004', '005'])
    })

    it('excludes scanned barcodes (Set)', () => {
      const result = filterMissingItems({
        locationData: baseItems,
        scannedBarcodes: new Set(['002', '004'])
      })
      expect(result).toHaveLength(3)
      expect(result.map((i) => i.barcode)).toEqual(['001', '003', '005'])
    })
  })

  describe('marked missing items filtering', () => {
    it('excludes already-marked-missing barcodes (Array)', () => {
      const result = filterMissingItems({
        locationData: baseItems,
        markedMissingBarcodes: ['001', '005']
      })
      expect(result).toHaveLength(3)
    })

    it('excludes already-marked-missing barcodes (Set)', () => {
      const result = filterMissingItems({
        locationData: baseItems,
        markedMissingBarcodes: new Set(['003'])
      })
      expect(result).toHaveLength(4)
    })
  })

  describe('session settings: skipCheckedOutItems', () => {
    it('does NOT skip checked-out items when setting is off', () => {
      const items = [makeItem('001', { checked_out: true }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipCheckedOutItems: false }
      })
      expect(result).toHaveLength(2)
    })

    it('skips items with checked_out flag when setting is on', () => {
      const items = [makeItem('001', { checked_out: true }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipCheckedOutItems: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('002')
    })

    it('skips items with checked_out_date when setting is on', () => {
      const items = [makeItem('001', { checked_out_date: '2025-01-01' }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipCheckedOutItems: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('002')
    })
  })

  describe('session settings: skipInTransitItems', () => {
    it('does NOT skip in-transit items when setting is off', () => {
      const items = [makeItem('001', { in_transit: true }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipInTransitItems: false }
      })
      expect(result).toHaveLength(2)
    })

    it('skips in-transit items when setting is on', () => {
      const items = [makeItem('001', { in_transit: true }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipInTransitItems: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('002')
    })
  })

  describe('session settings: skipBranchMismatchItems', () => {
    it('does NOT skip branch-mismatch items when setting is off', () => {
      const items = [makeItem('001', { holdingbranch: 'LIB_B' }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipBranchMismatchItems: false }
      })
      expect(result).toHaveLength(2)
    })

    it('skips branch-mismatch items when setting is on', () => {
      const items = [makeItem('001', { holdingbranch: 'LIB_B' }), makeItem('002')]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipBranchMismatchItems: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('002')
    })

    it('keeps items where homebranch matches holdingbranch', () => {
      const items = [
        makeItem('001', { homebranch: 'LIB_A', holdingbranch: 'LIB_A' }),
        makeItem('002', { homebranch: 'LIB_A', holdingbranch: 'LIB_B' })
      ]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: { skipBranchMismatchItems: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('001')
    })
  })

  describe('combined filters', () => {
    it('applies all filters simultaneously', () => {
      const items = [
        makeItem('001'), // should be included
        makeItem('002', { checked_out: true }), // skip: checked out
        makeItem('003', { in_transit: true }), // skip: in transit
        makeItem('004', { holdingbranch: 'LIB_B' }), // skip: branch mismatch
        makeItem('005') // skip: was scanned
      ]

      const result = filterMissingItems({
        locationData: items,
        scannedBarcodes: ['005'],
        markedMissingBarcodes: [],
        sessionSettings: {
          skipCheckedOutItems: true,
          skipInTransitItems: true,
          skipBranchMismatchItems: true
        }
      })

      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('001')
    })

    it('applies scanned + marked + settings together', () => {
      const items = [
        makeItem('001'), // skip: scanned
        makeItem('002'), // skip: marked missing
        makeItem('003', { checked_out: true }), // skip: checked out
        makeItem('004'), // should be included
        makeItem('005', { in_transit: true }) // skip: in transit
      ]

      const result = filterMissingItems({
        locationData: items,
        scannedBarcodes: new Set(['001']),
        markedMissingBarcodes: ['002'],
        sessionSettings: {
          skipCheckedOutItems: true,
          skipInTransitItems: true
        }
      })

      expect(result).toHaveLength(1)
      expect(result[0].barcode).toBe('004')
    })
  })

  describe('edge cases', () => {
    it('handles empty scannedBarcodes and markedMissingBarcodes', () => {
      const result = filterMissingItems({
        locationData: baseItems,
        scannedBarcodes: [],
        markedMissingBarcodes: []
      })
      expect(result).toHaveLength(5)
    })

    it('handles when all items are scanned', () => {
      const result = filterMissingItems({
        locationData: baseItems,
        scannedBarcodes: ['001', '002', '003', '004', '005']
      })
      expect(result).toHaveLength(0)
    })

    it('handles empty sessionSettings object', () => {
      const items = [
        makeItem('001', { checked_out: true, in_transit: true, holdingbranch: 'LIB_B' })
      ]
      const result = filterMissingItems({
        locationData: items,
        sessionSettings: {}
      })
      // All skip settings default to falsy, so item should be included
      expect(result).toHaveLength(1)
    })
  })
})
