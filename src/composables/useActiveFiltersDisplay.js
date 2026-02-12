import { ref } from 'vue'

export function useActiveFiltersDisplay() {
  const showFilters = ref(false)

  function getLibraryName(sessionData) {
    if (!sessionData?.selectedLibraryId) return 'All Libraries'
    return sessionData.selectedLibraryId
  }

  function getShelvingLocationName(sessionData) {
    if (!sessionData?.shelvingLocation) return 'All Locations'
    return sessionData.shelvingLocation
  }

  function getCollectionCodeName(sessionData) {
    if (!sessionData?.ccode) return 'All Collections'
    return sessionData.ccode
  }

  function getSelectedItemTypesText(sessionData) {
    if (!sessionData?.selectedItypes?.length) return 'All Item Types'
    const count = sessionData.selectedItypes.length
    return count === 1 ? sessionData.selectedItypes[0] : `${count} selected`
  }

  function getCallNumberRangeText(sessionData) {
    if (!sessionData?.minLocation && !sessionData?.maxLocation) {
      return 'All Call Numbers'
    }
    if (sessionData.minLocation && sessionData.maxLocation) {
      return `${sessionData.minLocation} - ${sessionData.maxLocation}`
    }
    if (sessionData.minLocation) {
      return `From: ${sessionData.minLocation}`
    }
    return `To: ${sessionData.maxLocation}`
  }

  function hasSkipFilters(sessionData) {
    return (
      sessionData?.skipCheckedOutItems ||
      sessionData?.skipInTransitItems ||
      sessionData?.skipBranchMismatchItems ||
      sessionData?.ignoreWaitingHolds
    )
  }

  function getSkipFiltersText(sessionData) {
    const filters = []
    if (sessionData?.skipCheckedOutItems) filters.push('Checked out items')
    if (sessionData?.skipInTransitItems) filters.push('In-transit items')
    if (sessionData?.skipBranchMismatchItems) filters.push('Branch mismatch items')
    if (sessionData?.ignoreWaitingHolds) filters.push('Items on hold')
    return filters.join(', ')
  }

  function getActiveFiltersCount(sessionData) {
    let count = 5

    if (sessionData?.dateLastSeen) count++
    if (hasSkipFilters(sessionData)) count++
    count++

    return count
  }

  function toggleFiltersDisplay() {
    showFilters.value = !showFilters.value
  }

  function formatDate(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString()
  }

  return {
    showFilters,
    getLibraryName,
    getShelvingLocationName,
    getCollectionCodeName,
    getSelectedItemTypesText,
    getCallNumberRangeText,
    hasSkipFilters,
    getSkipFiltersText,
    getActiveFiltersCount,
    toggleFiltersDisplay,
    formatDate
  }
}
