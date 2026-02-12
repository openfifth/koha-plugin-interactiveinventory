import { ref } from 'vue'

export function useCallNumberTracking() {
  const highestCallNumberSort = ref('')
  const itemWithHighestCallNumber = ref('')
  const biblioWithHighestCallNumber = ref(null)

  function isCallNumberOutOfOrder(currentCallNumberSort, highest) {
    if (!currentCallNumberSort || !highest) {
      return false
    }

    return currentCallNumberSort < highest
  }

  function checkItemStatuses(item, selectedStatuses) {
    item.invalidStatus = {}

    const statusKeyValuePairs = {
      'items.itemlost': item.lost_status,
      'items.notforloan': item.not_for_loan_status,
      'items.withdrawn': item.withdrawn,
      'items.damaged': item.damaged_status
    }

    for (const [key, value] of Object.entries(statusKeyValuePairs)) {
      if (value != '0' && !selectedStatuses[key].includes(String(value))) {
        item.invalidStatus['key'] = key
        item.invalidStatus['value'] = value
        break
      }
    }
  }

  function updateHighestCallNumber(items) {
    if (items.length > 0) {
      let highestSortValue = ''
      let highestItemBarcode = ''
      let highestBiblioId = ''

      items.forEach((item) => {
        const itemCallNumberSort = item.call_number_sort || ''
        if (itemCallNumberSort && itemCallNumberSort > highestSortValue) {
          highestSortValue = itemCallNumberSort
          highestItemBarcode = item.external_id
          highestBiblioId = item.biblio_id
        }
      })

      highestCallNumberSort.value = highestSortValue
      itemWithHighestCallNumber.value = highestItemBarcode
      biblioWithHighestCallNumber.value = highestBiblioId || null
    }
  }

  return {
    highestCallNumberSort,
    itemWithHighestCallNumber,
    biblioWithHighestCallNumber,
    isCallNumberOutOfOrder,
    checkItemStatuses,
    updateHighestCallNumber
  }
}
