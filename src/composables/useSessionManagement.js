import { EventBus } from '../components/eventBus'
import {
  saveSession,
  getSession,
  saveItems,
  getItems,
  clearSession,
  saveMarkedMissingItems,
  getMarkedMissingItems,
  isSessionActive
} from '../services/sessionStorage'

export function useSessionManagement() {
  function checkForExistingSession({
    sessionDataSetter,
    sessionStartedSetter,
    itemsSetter,
    markedMissingItemsSetter,
    updateHighestCallNumberFn,
    focusBarcodeInputFn,
    loadFormDataFn
  }) {
    if (isSessionActive()) {
      getSession()
        .then((savedSessionData) => {
          if (savedSessionData) {
            sessionDataSetter(savedSessionData)
            sessionStartedSetter(true)

            return getItems().then((savedItems) => {
              if (savedItems) {
                itemsSetter(savedItems)
                updateHighestCallNumberFn()
              }
              return getMarkedMissingItems()
            })
          }
          return Promise.reject('No saved session data found')
        })
        .then((savedMarkedMissingItems) => {
          if (savedMarkedMissingItems && Array.isArray(savedMarkedMissingItems)) {
            markedMissingItemsSetter(new Set(savedMarkedMissingItems))
          }

          EventBus.emit('message', { text: 'Session restored successfully', type: 'status' })

          focusBarcodeInputFn()
        })
        .catch((error) => {
          if (error !== 'No saved session data found') {
            console.error('Error restoring session:', error)
            EventBus.emit('message', {
              text: 'Error restoring session: ' + (error.message || error),
              type: 'error'
            })
          }
        })
    } else {
      loadFormDataFn()
    }
  }

  function initiateInventorySession(
    sessionData,
    {
      sessionDataSetter,
      sessionStartedSetter,
      sessionInitializingSetter,
      manualResolutionEnabledSetter,
      resolutionSettingsSetter,
      itemsSetter,
      focusBarcodeInputFn
    }
  ) {
    sessionDataSetter(sessionData)
    sessionStartedSetter(true)
    sessionInitializingSetter(true)

    const manualResolutionEnabled =
      sessionData.resolutionSettings?.enableManualResolution !== undefined
        ? sessionData.resolutionSettings.enableManualResolution
        : true

    manualResolutionEnabledSetter(manualResolutionEnabled)

    resolutionSettingsSetter({
      resolveReturnClaims: sessionData.resolutionSettings?.resolveReturnClaims || false,
      resolveInTransitItems: sessionData.resolutionSettings?.resolveInTransitItems || false,
      resolveWithdrawnItems: sessionData.resolutionSettings?.resolveWithdrawnItems || false,
      enableManualResolution: manualResolutionEnabled,
      resolveLostItems: sessionData.resolutionSettings?.resolveLostItems || false
    })

    if (sessionData.shelvingLocation) {
      const locationName =
        sessionData.shelvingLocations && sessionData.shelvingLocations[sessionData.shelvingLocation]
          ? sessionData.shelvingLocations[sessionData.shelvingLocation]
          : sessionData.shelvingLocation
      EventBus.emit('message', {
        type: 'status',
        text: `Applying shelving location filter: ${locationName}`
      })
    }

    if (sessionData.compareBarcodes) {
      EventBus.emit('message', {
        type: 'status',
        text: 'Expected barcodes comparison mode is ON. Generating expected barcodes list...'
      })
    } else {
      EventBus.emit('message', {
        type: 'status',
        text: 'Expected barcodes comparison mode is OFF. No expected barcodes list will be generated.'
      })
    }

    EventBus.emit('message', { type: 'status', text: 'Starting inventory session...' })

    const pluginBase =
      '/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=tool'
    const fetchOpts = { method: 'GET', headers: { Accept: 'application/json' } }

    const parseResponse = async (response) => {
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }
      const text = await response.text()
      const data = JSON.parse(text)
      if (data.error) throw new Error(`API error: ${data.error}`)
      return data
    }

    const PAGE_SIZE = 25000

    const fetchAllPages = async (inventoryParams, totalRecords) => {
      const allItems = []
      let offset = 0
      const encodedParams = encodeURIComponent(JSON.stringify(inventoryParams))

      while (offset < totalRecords) {
        const url = `${pluginBase}&action=get_inventory_page&inventory_params=${encodedParams}&offset=${offset}&size=${PAGE_SIZE}`
        const data = await parseResponse(await fetch(url, fetchOpts))
        const items = data.items || []

        allItems.push(...items)

        EventBus.emit('message', {
          type: 'status',
          text: `Loading items: ${allItems.length} / ${totalRecords}`
        })

        if (items.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }

      return allItems
    }

    fetch(
      `${pluginBase}&action=start_session&session_data=${encodeURIComponent(JSON.stringify(sessionData))}`,
      fetchOpts
    )
      .then((response) => parseResponse(response))
      .then((data) => {
        if (!data.right_place_list || !Array.isArray(data.right_place_list)) {
          data.right_place_list = []
        }

        const totalRecords = data.total_records || 0
        const inventoryParams = data.inventory_params || {}

        EventBus.emit('message', {
          type: 'status',
          text: `Session created. Loading ${totalRecords} items...`
        })

        return fetchAllPages(inventoryParams, totalRecords).then((locationData) => {
          sessionData.response_data = {
            location_data: locationData,
            total_records: totalRecords,
            right_place_list: data.right_place_list
          }

          return saveSession(sessionData).catch((error) => {
            console.error('Inventory session error when saving session:', error)
            EventBus.emit('message', {
              text: `Error saving session data: ${error.message}. Try using fewer filters or a smaller item set.`,
              type: 'error'
            })
          })
        })
      })
      .then(() => {
        itemsSetter([])
        return saveItems([]).catch((error) => {
          console.error('Error saving empty items list:', error)
        })
      })
      .then(() => {
        if (sessionData.compareBarcodes) {
          const rightPlaceList = sessionData.response_data.right_place_list || []
          if (rightPlaceList.length > 0) {
            EventBus.emit('message', {
              text: `Expected barcodes list contains ${rightPlaceList.length} barcodes. Items not on this list will be flagged.`,
              type: 'status'
            })

            if (sessionData.ccode) {
              EventBus.emit('message', {
                text: `Expected barcodes list is filtered by collection code: ${sessionData.ccode}`,
                type: 'info'
              })
            }
          } else {
            if (sessionData.ccode) {
              EventBus.emit('message', {
                text: `Expected barcodes list is empty, possibly because of the collection code filter (${sessionData.ccode}). No items will be marked as unexpected.`,
                type: 'warning'
              })
            } else {
              EventBus.emit('message', {
                text: 'Expected barcodes list is empty. No items will be marked as unexpected.',
                type: 'warning'
              })
            }
          }
        } else {
          EventBus.emit('message', {
            text: 'Not comparing scanned items to an expected barcodes list. All scanned items will be accepted.',
            type: 'status'
          })
        }

        EventBus.emit('message', {
          text: `Inventory session started with ${sessionData.response_data.total_records || 0} items`,
          type: 'status'
        })

        setTimeout(() => {
          sessionInitializingSetter(false)
          focusBarcodeInputFn()
        }, 1000)
      })
      .catch((error) => {
        console.error('Inventory session error:', error)
        sessionStartedSetter(false)
        sessionDataSetter(null)
        sessionInitializingSetter(false)

        EventBus.emit('message', {
          text: `Error starting inventory session: ${error.message}`,
          type: 'error'
        })
      })
  }

  function completeSession(sessionData, items, markedMissingItems, resetStateFn) {
    saveSession(sessionData)
      .then(() => {
        return saveItems(items)
      })
      .then(() => {
        if (markedMissingItems.size > 0) {
          return saveMarkedMissingItems(Array.from(markedMissingItems))
        }
        return Promise.resolve()
      })
      .then(() => {
        resetStateFn()

        return clearSession()
      })
      .then(() => {
        EventBus.emit('message', { text: 'Inventory session ended', type: 'status' })
      })
      .catch((error) => {
        console.error('Error completing session:', error)
        EventBus.emit('message', {
          text: 'Error ending session: ' + error.message,
          type: 'error'
        })
      })
  }

  return {
    checkForExistingSession,
    initiateInventorySession,
    completeSession
  }
}
