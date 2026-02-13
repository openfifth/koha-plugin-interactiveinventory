import { ref } from 'vue'
import { EventBus } from '../components/eventBus'
import { saveMarkedMissingItems, getMarkedMissingItems } from '../services/sessionStorage'
import { filterMissingItems } from '../utils/missingItems'

export function useMissingItems() {
  const markedMissingItems = ref(new Set())

  function getMissingItemsCount(sessionData, items) {
    if (!sessionData || !sessionData.response_data) {
      return 0
    }

    const locationData = sessionData.response_data.location_data || []

    let itemsToCheck = locationData
    if (itemsToCheck.length === 0 && sessionData.response_data.right_place_list) {
      itemsToCheck = sessionData.response_data.right_place_list
    }

    if (itemsToCheck.length === 0) {
      return 0
    }

    const scannedBarcodesSet = new Set(items.map((item) => item.external_id))

    const markedMissingSet = markedMissingItems.value

    const count = filterMissingItems({
      locationData: itemsToCheck,
      rightPlaceList: [],
      scannedBarcodes: scannedBarcodesSet,
      markedMissingBarcodes: markedMissingSet,
      sessionSettings: {
        skipCheckedOutItems: sessionData.skipCheckedOutItems,
        skipInTransitItems: sessionData.skipInTransitItems,
        skipBranchMismatchItems: sessionData.skipBranchMismatchItems
      }
    }).length

    return count
  }

  function handleItemMarkedMissing(barcode) {
    markedMissingItems.value.add(barcode)
    saveMarkedMissingItems(Array.from(markedMissingItems.value))
  }

  function handleItemsMarkedMissing(barcodes) {
    barcodes.forEach((barcode) => markedMissingItems.value.add(barcode))
    saveMarkedMissingItems(Array.from(markedMissingItems.value))
  }

  function markItemMissing(barcode) {
    markedMissingItems.value.add(barcode)

    const barcodesArray = Array.from(markedMissingItems.value)

    saveMarkedMissingItems(barcodesArray)
      .then(() => {
        EventBus.emit('message', { text: `Item ${barcode} marked as missing`, type: 'status' })
      })
      .catch((error) => {
        console.error('Error marking item as missing:', error)
        EventBus.emit('message', {
          text: 'Error marking item as missing: ' + error.message,
          type: 'error'
        })
      })
  }

  async function handleMissingItemsUpdated() {
    try {
      const markedItems = await getMarkedMissingItems()
      markedMissingItems.value = new Set(Array.isArray(markedItems) ? markedItems : [])
    } catch (error) {
      console.error('Error updating marked missing items:', error)
      markedMissingItems.value = new Set()
    }
  }

  return {
    markedMissingItems,
    getMissingItemsCount,
    handleItemMarkedMissing,
    handleItemsMarkedMissing,
    markItemMissing,
    handleMissingItemsUpdated
  }
}
