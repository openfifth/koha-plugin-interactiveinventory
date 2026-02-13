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

    fetch(
      `/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=tool&action=start_session&session_data=${encodeURIComponent(JSON.stringify(sessionData))}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    )
      .then((response) => {
        if (!response.ok) {
          return response.headers.get('content-type').includes('application/json')
            ? response.json().then((errorData) => {
                throw new Error(
                  errorData.error || `Server error: ${response.status} ${response.statusText}`
                )
              })
            : response.text().then((errorText) => {
                throw new Error(`Non-JSON error response: ${errorText || response.statusText}`)
              })
        }

        return response.text().then((responseText) => {
          try {
            return JSON.parse(responseText)
          } catch (jsonError) {
            console.error('JSON Parse Error:', jsonError, 'Response text:', responseText)
            throw new Error(`Invalid JSON response: ${jsonError.message}`)
          }
        })
      })
      .then((data) => {
        if (!data) {
          throw new Error('Empty response received')
        }

        if (data.error) {
          throw new Error(`API error: ${data.error}`)
        }

        if (!data.location_data || !Array.isArray(data.location_data)) {
          console.warn('Invalid location_data in response:', data)
          data.location_data = []
        }

        if (!data.right_place_list || !Array.isArray(data.right_place_list)) {
          console.warn('Invalid right_place_list in response:', data)
          data.right_place_list = []
        }

        sessionData.response_data = data

        return saveSession(sessionData).catch((error) => {
          console.error('Inventory session error when saving session:', error)
          EventBus.emit('message', {
            text: `Error saving session data: ${error.message}. Try using fewer filters or a smaller item set.`,
            type: 'error'
          })
        })
      })
      .then(() => {
        const emptyItems = []
        itemsSetter(emptyItems)
        return saveItems(emptyItems).catch((error) => {
          console.error('Error saving empty items list:', error)
        })
      })
      .then(() => {
        if (sessionData.compareBarcodes) {
          const rightPlaceList = sessionData.response_data.right_place_list || []
          if (rightPlaceList.length > 0) {
            EventBus.emit('message', {
              text: `Expected barcodes list contains ${rightPlaceList.length} items. Items not on this list will be flagged.`,
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

        if (error.message.includes('JSON')) {
          EventBus.emit('message', {
            text: 'There was a problem with the server response. Please try again or contact support.',
            type: 'error'
          })
        }
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
