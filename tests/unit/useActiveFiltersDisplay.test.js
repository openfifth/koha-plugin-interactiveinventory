import { describe, it, expect } from 'vitest'
import { useActiveFiltersDisplay } from '../../src/composables/useActiveFiltersDisplay'

describe('useActiveFiltersDisplay', () => {
  it('returns reactive showFilters ref initialized to false', () => {
    const { showFilters } = useActiveFiltersDisplay()
    expect(showFilters.value).toBe(false)
  })

  it('returns all required methods', () => {
    const composable = useActiveFiltersDisplay()
    expect(typeof composable.getLibraryName).toBe('function')
    expect(typeof composable.getShelvingLocationName).toBe('function')
    expect(typeof composable.getCollectionCodeName).toBe('function')
    expect(typeof composable.getSelectedItemTypesText).toBe('function')
    expect(typeof composable.getCallNumberRangeText).toBe('function')
    expect(typeof composable.hasSkipFilters).toBe('function')
    expect(typeof composable.getSkipFiltersText).toBe('function')
    expect(typeof composable.getActiveFiltersCount).toBe('function')
    expect(typeof composable.toggleFiltersDisplay).toBe('function')
    expect(typeof composable.formatDate).toBe('function')
  })

  describe('getLibraryName', () => {
    const { getLibraryName } = useActiveFiltersDisplay()

    it('returns "All Libraries" when no selectedLibraryId', () => {
      expect(getLibraryName({})).toBe('All Libraries')
      expect(getLibraryName(null)).toBe('All Libraries')
      expect(getLibraryName(undefined)).toBe('All Libraries')
    })

    it('returns selectedLibraryId when present', () => {
      expect(getLibraryName({ selectedLibraryId: 'LIB_A' })).toBe('LIB_A')
      expect(getLibraryName({ selectedLibraryId: 'MAIN' })).toBe('MAIN')
    })
  })

  describe('getShelvingLocationName', () => {
    const { getShelvingLocationName } = useActiveFiltersDisplay()

    it('returns "All Locations" when no shelvingLocation', () => {
      expect(getShelvingLocationName({})).toBe('All Locations')
      expect(getShelvingLocationName(null)).toBe('All Locations')
    })

    it('returns shelvingLocation when present', () => {
      expect(getShelvingLocationName({ shelvingLocation: 'FICTION' })).toBe('FICTION')
      expect(getShelvingLocationName({ shelvingLocation: 'REF' })).toBe('REF')
    })
  })

  describe('getCollectionCodeName', () => {
    const { getCollectionCodeName } = useActiveFiltersDisplay()

    it('returns "All Collections" when no ccode', () => {
      expect(getCollectionCodeName({})).toBe('All Collections')
      expect(getCollectionCodeName(null)).toBe('All Collections')
    })

    it('returns ccode when present', () => {
      expect(getCollectionCodeName({ ccode: 'ADULT' })).toBe('ADULT')
      expect(getCollectionCodeName({ ccode: 'CHILDREN' })).toBe('CHILDREN')
    })
  })

  describe('getSelectedItemTypesText', () => {
    const { getSelectedItemTypesText } = useActiveFiltersDisplay()

    it('returns "All Item Types" when no selectedItypes', () => {
      expect(getSelectedItemTypesText({})).toBe('All Item Types')
      expect(getSelectedItemTypesText({ selectedItypes: [] })).toBe('All Item Types')
      expect(getSelectedItemTypesText(null)).toBe('All Item Types')
    })

    it('returns single item type when only one selected', () => {
      expect(getSelectedItemTypesText({ selectedItypes: ['BOOK'] })).toBe('BOOK')
      expect(getSelectedItemTypesText({ selectedItypes: ['DVD'] })).toBe('DVD')
    })

    it('returns count when multiple item types selected', () => {
      expect(getSelectedItemTypesText({ selectedItypes: ['BOOK', 'DVD'] })).toBe('2 selected')
      expect(getSelectedItemTypesText({ selectedItypes: ['BOOK', 'DVD', 'CD'] })).toBe('3 selected')
    })
  })

  describe('getCallNumberRangeText', () => {
    const { getCallNumberRangeText } = useActiveFiltersDisplay()

    it('returns "All Call Numbers" when no range specified', () => {
      expect(getCallNumberRangeText({})).toBe('All Call Numbers')
      expect(getCallNumberRangeText(null)).toBe('All Call Numbers')
    })

    it('returns range when both min and max specified', () => {
      expect(getCallNumberRangeText({ minLocation: '100', maxLocation: '200' })).toBe('100 - 200')
      expect(getCallNumberRangeText({ minLocation: 'A', maxLocation: 'Z' })).toBe('A - Z')
    })

    it('returns "From:" when only minLocation specified', () => {
      expect(getCallNumberRangeText({ minLocation: '100' })).toBe('From: 100')
      expect(getCallNumberRangeText({ minLocation: 'A' })).toBe('From: A')
    })

    it('returns "To:" when only maxLocation specified', () => {
      expect(getCallNumberRangeText({ maxLocation: '200' })).toBe('To: 200')
      expect(getCallNumberRangeText({ maxLocation: 'Z' })).toBe('To: Z')
    })
  })

  describe('hasSkipFilters', () => {
    const { hasSkipFilters } = useActiveFiltersDisplay()

    it('returns false when no skip filters set', () => {
      expect(hasSkipFilters({})).toBeFalsy()
      expect(hasSkipFilters(null)).toBeFalsy()
    })

    it('returns true when skipCheckedOutItems is set', () => {
      expect(hasSkipFilters({ skipCheckedOutItems: true })).toBe(true)
    })

    it('returns true when skipInTransitItems is set', () => {
      expect(hasSkipFilters({ skipInTransitItems: true })).toBe(true)
    })

    it('returns true when skipBranchMismatchItems is set', () => {
      expect(hasSkipFilters({ skipBranchMismatchItems: true })).toBe(true)
    })

    it('returns true when ignoreWaitingHolds is set', () => {
      expect(hasSkipFilters({ ignoreWaitingHolds: true })).toBe(true)
    })

    it('returns true when multiple skip filters are set', () => {
      expect(
        hasSkipFilters({
          skipCheckedOutItems: true,
          skipInTransitItems: true
        })
      ).toBe(true)
    })

    it('returns false when skip filters are explicitly false', () => {
      expect(
        hasSkipFilters({
          skipCheckedOutItems: false,
          skipInTransitItems: false,
          skipBranchMismatchItems: false,
          ignoreWaitingHolds: false
        })
      ).toBe(false)
    })
  })

  describe('getSkipFiltersText', () => {
    const { getSkipFiltersText } = useActiveFiltersDisplay()

    it('returns empty string when no skip filters', () => {
      expect(getSkipFiltersText({})).toBe('')
      expect(getSkipFiltersText(null)).toBe('')
    })

    it('returns single filter text', () => {
      expect(getSkipFiltersText({ skipCheckedOutItems: true })).toBe('Checked out items')
      expect(getSkipFiltersText({ skipInTransitItems: true })).toBe('In-transit items')
      expect(getSkipFiltersText({ skipBranchMismatchItems: true })).toBe('Branch mismatch items')
      expect(getSkipFiltersText({ ignoreWaitingHolds: true })).toBe('Items on hold')
    })

    it('returns comma-separated filters when multiple set', () => {
      expect(
        getSkipFiltersText({
          skipCheckedOutItems: true,
          skipInTransitItems: true
        })
      ).toBe('Checked out items, In-transit items')

      expect(
        getSkipFiltersText({
          skipCheckedOutItems: true,
          skipInTransitItems: true,
          skipBranchMismatchItems: true
        })
      ).toBe('Checked out items, In-transit items, Branch mismatch items')
    })

    it('returns all filters in correct order', () => {
      expect(
        getSkipFiltersText({
          skipCheckedOutItems: true,
          skipInTransitItems: true,
          skipBranchMismatchItems: true,
          ignoreWaitingHolds: true
        })
      ).toBe('Checked out items, In-transit items, Branch mismatch items, Items on hold')
    })
  })

  describe('getActiveFiltersCount', () => {
    const { getActiveFiltersCount } = useActiveFiltersDisplay()

    it('returns base count of 6 for empty session data', () => {
      expect(getActiveFiltersCount({})).toBe(6)
      expect(getActiveFiltersCount(null)).toBe(6)
    })

    it('increments count when dateLastSeen is set', () => {
      expect(getActiveFiltersCount({ dateLastSeen: '2025-01-01' })).toBe(7)
    })

    it('increments count when skip filters are present', () => {
      expect(getActiveFiltersCount({ skipCheckedOutItems: true })).toBe(7)
      expect(getActiveFiltersCount({ skipInTransitItems: true })).toBe(7)
    })

    it('increments count for both dateLastSeen and skip filters', () => {
      expect(
        getActiveFiltersCount({
          dateLastSeen: '2025-01-01',
          skipCheckedOutItems: true
        })
      ).toBe(8)
    })

    it('always adds 1 to base count', () => {
      const baseCount = getActiveFiltersCount({})
      expect(baseCount).toBe(6)
    })
  })

  describe('toggleFiltersDisplay', () => {
    it('toggles showFilters ref value', () => {
      const { showFilters, toggleFiltersDisplay } = useActiveFiltersDisplay()

      expect(showFilters.value).toBe(false)
      toggleFiltersDisplay()
      expect(showFilters.value).toBe(true)
      toggleFiltersDisplay()
      expect(showFilters.value).toBe(false)
    })

    it('can toggle multiple times', () => {
      const { showFilters, toggleFiltersDisplay } = useActiveFiltersDisplay()

      toggleFiltersDisplay()
      toggleFiltersDisplay()
      toggleFiltersDisplay()
      expect(showFilters.value).toBe(true)

      toggleFiltersDisplay()
      expect(showFilters.value).toBe(false)
    })
  })

  describe('formatDate', () => {
    const { formatDate } = useActiveFiltersDisplay()

    it('returns empty string when no date provided', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate(undefined)).toBe('')
      expect(formatDate('')).toBe('')
    })

    it('formats valid date string', () => {
      const result = formatDate('2025-01-15')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('formats ISO date string', () => {
      const result = formatDate('2025-01-15T10:30:00Z')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('uses locale date format', () => {
      const result = formatDate('2025-12-25')
      expect(result).toMatch(/\d+/)
    })
  })

  describe('integration: multiple methods together', () => {
    it('can build complete filter display from session data', () => {
      const {
        getLibraryName,
        getShelvingLocationName,
        getCollectionCodeName,
        getSelectedItemTypesText
      } = useActiveFiltersDisplay()

      const sessionData = {
        selectedLibraryId: 'MAIN',
        shelvingLocation: 'FICTION',
        ccode: 'ADULT',
        selectedItypes: ['BOOK', 'DVD']
      }

      expect(getLibraryName(sessionData)).toBe('MAIN')
      expect(getShelvingLocationName(sessionData)).toBe('FICTION')
      expect(getCollectionCodeName(sessionData)).toBe('ADULT')
      expect(getSelectedItemTypesText(sessionData)).toBe('2 selected')
    })

    it('handles partial session data gracefully', () => {
      const { getLibraryName, getShelvingLocationName, getCollectionCodeName } =
        useActiveFiltersDisplay()

      const sessionData = {
        selectedLibraryId: 'MAIN'
      }

      expect(getLibraryName(sessionData)).toBe('MAIN')
      expect(getShelvingLocationName(sessionData)).toBe('All Locations')
      expect(getCollectionCodeName(sessionData)).toBe('All Collections')
    })
  })
})
