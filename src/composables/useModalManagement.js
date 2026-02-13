import { ref } from 'vue'
import { EventBus } from '../components/eventBus'
import { saveItems } from '../services/sessionStorage'

export function useModalManagement() {
  const showEndSessionModal = ref(false)
  const showMissingItemsModal = ref(false)
  const showShelfPreview = ref(false)
  const showResolutionModal = ref(false)
  const currentResolutionItem = ref(null)
  const currentResolutionType = ref('')
  const currentPatronName = ref('')
  const isMobileView = ref(false)
  const scannerMode = ref(false)

  function toggleEndSessionModal() {
    if (showShelfPreview.value) {
      showShelfPreview.value = false
    }
    showEndSessionModal.value = !showEndSessionModal.value
  }

  function toggleMissingItemsModal(handleMissingItemsUpdatedFn) {
    if (showShelfPreview.value) {
      showShelfPreview.value = false
    }

    showMissingItemsModal.value = !showMissingItemsModal.value

    if (showMissingItemsModal.value) {
      handleMissingItemsUpdatedFn()
    }
  }

  function closeMissingItemsModal() {
    showMissingItemsModal.value = false
  }

  function toggleShelfPreview(loadAuthorizedValueCategoriesFn) {
    showShelfPreview.value = !showShelfPreview.value

    if (showShelfPreview.value) {
      loadAuthorizedValueCategoriesFn()
    }
  }

  function closeShelfPreview() {
    showShelfPreview.value = false
  }

  function openResolutionModal(item, type, patronName, items) {
    item.wasScanned = true

    const newItem = { ...item }

    switch (type) {
      case 'checkedout':
        newItem.pendingResolution = true
        newItem.resolutionType = 'checkedout'
        break

      case 'lost':
        newItem.wasLost = true
        newItem.pendingResolution = true
        newItem.resolutionType = 'lost'
        newItem.originalLostStatus = newItem.lost_status
        break

      case 'intransit':
        newItem.pendingResolution = true
        newItem.resolutionType = 'intransit'
        break

      case 'returnclaim':
        newItem.pendingResolution = true
        newItem.resolutionType = 'returnclaim'
        break

      case 'withdrawn':
        newItem.pendingResolution = true
        newItem.resolutionType = 'withdrawn'
        break
    }

    items.unshift(newItem)

    const mapped = items.map((itm, index) => ({
      ...itm,
      isExpanded: index === 0
    }))
    items.length = 0
    mapped.forEach((itm) => items.push(itm))

    saveItems(items).catch((error) => {
      console.error('Error saving items after resolution modal:', error)
    })

    currentResolutionItem.value = newItem
    currentResolutionType.value = type
    currentPatronName.value = patronName || ''
    showResolutionModal.value = true
  }

  function closeResolutionModal() {
    showResolutionModal.value = false
    currentResolutionItem.value = null
    currentResolutionType.value = ''
    currentPatronName.value = ''
  }

  function checkDeviceType() {
    isMobileView.value = window.innerWidth < 768
  }

  function toggleScannerMode() {
    if (scannerMode.value) {
      try {
        EventBus.emit('stop-scanner')
        setTimeout(() => {
          scannerMode.value = false
        }, 200)
      } catch (e) {
        scannerMode.value = false
      }
    } else {
      scannerMode.value = true
    }
  }

  function handleToggleExpand(itemId, items) {
    const mapped = items.map((item, index) => ({
      ...item,
      isExpanded: `${index}-${item.id}` === itemId ? !item.isExpanded : false
    }))
    items.length = 0
    mapped.forEach((item) => items.push(item))
  }

  return {
    showEndSessionModal,
    showMissingItemsModal,
    showShelfPreview,
    showResolutionModal,
    currentResolutionItem,
    currentResolutionType,
    currentPatronName,
    isMobileView,
    scannerMode,
    toggleEndSessionModal,
    toggleMissingItemsModal,
    closeMissingItemsModal,
    toggleShelfPreview,
    closeShelfPreview,
    openResolutionModal,
    closeResolutionModal,
    checkDeviceType,
    toggleScannerMode,
    handleToggleExpand
  }
}
