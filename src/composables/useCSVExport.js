import { EventBus } from '../components/eventBus'

export function exportDataToCSV({ items, sessionData, exportMissingOnly, filterMissingItemsFn }) {
  const headers = [
    'Barcode',
    'Item ID',
    'Biblio ID',
    'Title',
    'Author',
    'Publication Year',
    'Publisher',
    'ISBN',
    'Pages',
    'Location',
    'Acquisition Date',
    'Last Seen Date',
    'URL',
    'Was Lost',
    'Wrong Place',
    'Was Checked Out',
    'Scanned Out of Order',
    'Had Invalid "Not for loan" Status',
    'Scanned',
    'Status'
  ]

  const scannedItemsMap = new Map(items.map((item) => [item.external_id, item]))

  const locationData = sessionData.response_data.location_data || []
  const expectedBarcodesSet = new Set(locationData.map((item) => item.barcode))

  let combinedItems = [
    ...locationData,
    ...items.filter((item) => !expectedBarcodesSet.has(item.external_id))
  ]

  if (exportMissingOnly) {
    combinedItems = combinedItems.filter((item) => {
      const barcode = item.barcode || item.external_id
      return expectedBarcodesSet.has(barcode) && !scannedItemsMap.has(barcode)
    })
  }

  const csvContent = [
    headers.join(','),
    ...combinedItems.map((item) => {
      const scannedItem = scannedItemsMap.get(item.barcode)
      const combinedItem = { ...item }

      if (scannedItem) {
        for (const key in scannedItem) {
          if (
            !combinedItem.hasOwnProperty(key) ||
            combinedItem[key] === null ||
            combinedItem[key] === undefined
          ) {
            combinedItem[key] = scannedItem[key]
          }
        }
      }
      const wasScanned = scannedItem || combinedItem.wasScanned

      let status = 'OK'
      if (
        !wasScanned &&
        expectedBarcodesSet.has(combinedItem.barcode || combinedItem.external_id)
      ) {
        status = 'Missing'
      } else if (combinedItem.wrongPlace) {
        status = 'Wrong Place'
      } else if (combinedItem.outOfOrder) {
        status = 'Out of Order'
      } else if (combinedItem.invalidStatus) {
        status = 'Invalid Status'
      } else if (combinedItem.wasLost) {
        status = 'Was Lost'
      }

      return [
        `"${combinedItem.barcode || combinedItem.external_id}"`,
        `"${combinedItem.itemnumber || combinedItem.item_id}"`,
        `"${combinedItem.biblionumber || combinedItem.biblio_id}"`,
        `"${combinedItem.title || (combinedItem.biblio && combinedItem.biblio.title) || 'N/A'}"`,
        `"${combinedItem.author || (combinedItem.biblio && combinedItem.biblio.author) || 'N/A'}"`,
        `"${(combinedItem.biblio && combinedItem.biblio.publication_year) || 'N/A'}"`,
        `"${(combinedItem.biblio && combinedItem.biblio.publisher) || 'N/A'}"`,
        `"${(combinedItem.biblio && combinedItem.biblio.isbn) || 'N/A'}"`,
        `"${(combinedItem.biblio && combinedItem.biblio.pages) || 'N/A'}"`,
        `"${combinedItem.location || 'N/A'}"`,
        `"${combinedItem.acquisition_date || 'N/A'}"`,
        `"${combinedItem.datelastseen || combinedItem.last_seen_date || 'N/A'}"`,
        `"${window.location.origin}/cgi-bin/koha/catalogue/detail.pl?biblionumber=${combinedItem.biblionumber || combinedItem.biblio_id}"`,
        `"${combinedItem.wasLost ? 'Yes' : 'No'}"`,
        `"${combinedItem.wrongPlace ? 'Yes' : 'No'}"`,
        `"${combinedItem.checked_out_date ? 'Yes' : 'No'}"`,
        `"${combinedItem.outOfOrder ? 'Yes' : 'No'}"`,
        `"${combinedItem.invalidStatus ? 'Yes' : 'No'}"`,
        `"${wasScanned ? 'Yes' : 'NOT SCANNED'}"`,
        `"${status}"`
      ].join(',')
    })
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportMissingOnly ? 'missing_items.csv' : 'inventory.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  EventBus.emit('message', {
    type: 'success',
    text: `Exported ${combinedItems.length} items to CSV${exportMissingOnly ? ' (missing items only)' : ''}`
  })
}
