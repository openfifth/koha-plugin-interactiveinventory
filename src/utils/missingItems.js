/**
 * Filters location data to find items that are missing (not scanned, not already marked, not excluded by session settings).
 * @param {Object} options
 * @param {Array} options.locationData - Items from session response_data.location_data
 * @param {Array} options.rightPlaceList - Fallback items from session response_data.right_place_list
 * @param {Set|Array} options.scannedBarcodes - Barcodes that have been scanned (as external_id values)
 * @param {Set|Array} options.markedMissingBarcodes - Barcodes already marked as missing
 * @param {Object} options.sessionSettings - Session config with skipCheckedOutItems, skipInTransitItems, skipBranchMismatchItems
 * @returns {Array} Items that are missing
 */
export function filterMissingItems({
  locationData = [],
  rightPlaceList = [],
  scannedBarcodes = [],
  markedMissingBarcodes = [],
  sessionSettings = {}
}) {
  // Determine which items to check - locationData first, fallback to rightPlaceList
  let itemsToCheck = locationData
  if (itemsToCheck.length === 0 && rightPlaceList.length > 0) {
    itemsToCheck = rightPlaceList
  }
  if (itemsToCheck.length === 0) return []

  // Normalize to Sets for O(1) lookup
  const scannedSet = scannedBarcodes instanceof Set ? scannedBarcodes : new Set(scannedBarcodes)
  const markedSet =
    markedMissingBarcodes instanceof Set ? markedMissingBarcodes : new Set(markedMissingBarcodes)

  return itemsToCheck.filter((item) => {
    if (scannedSet.has(item.barcode)) return false
    if (markedSet.has(item.barcode)) return false
    if (sessionSettings.skipCheckedOutItems && (item.checked_out || item.checked_out_date))
      return false
    if (sessionSettings.skipInTransitItems && item.in_transit) return false
    if (sessionSettings.skipBranchMismatchItems && item.homebranch !== item.holdingbranch)
      return false
    return true
  })
}
