<template>
  <div class="container">
    <InventorySetupForm
      ref="setupForm"
      @start-session="initiateInventorySession"
      :fetchAuthorizedValues="fetchAuthorizedValues"
      v-if="!sessionStarted"
    />
    <div v-else>
      <!-- Loading indicator while session is initializing -->
      <div v-if="sessionInitializing" class="session-initializing">
        <div class="spinner"></div>
        <p>Please wait while the inventory session initializes...</p>
        <p class="loading-detail">Loading expected barcodes and location data</p>
      </div>

      <div v-else>
        <!-- Active Filters Display -->
        <div v-if="sessionData" class="active-filters-container">
          <div class="filters-header" @click="toggleFiltersDisplay">
            <h3>
              Active Filters
              <span class="filter-summary">({{ getActiveFiltersCount() }} active)</span>
            </h3>
            <button class="toggle-button" :class="{ expanded: showFilters }">
              {{ showFilters ? '▼' : '▶' }}
            </button>
          </div>

          <div v-if="showFilters" class="active-filters">
            <div class="filters-grid">
              <div class="filter-item"><strong>Library:</strong> {{ getLibraryName() }}</div>
              <div class="filter-item">
                <strong>Shelving Location:</strong> {{ getShelvingLocationName() }}
              </div>
              <div class="filter-item">
                <strong>Collection Code:</strong> {{ getCollectionCodeName() }}
              </div>
              <div class="filter-item">
                <strong>Call Number Range:</strong> {{ getCallNumberRangeText() }}
              </div>
              <div class="filter-item">
                <strong>Item Types:</strong> {{ getSelectedItemTypesText() }}
              </div>
              <div v-if="sessionData.dateLastSeen" class="filter-item">
                <strong>Last Seen After:</strong> {{ formatDate(sessionData.dateLastSeen) }}
              </div>
              <div v-if="hasSkipFilters()" class="filter-item">
                <strong>Excluding:</strong> {{ getSkipFiltersText() }}
              </div>
              <div
                class="filter-item"
                :class="sessionData.compareBarcodes ? 'comparison-mode' : 'scan-mode'"
              >
                <strong>Mode:</strong>
                {{
                  sessionData.compareBarcodes
                    ? 'Comparing against expected barcodes'
                    : 'Accept all scanned barcodes'
                }}
              </div>
            </div>
          </div>
        </div>

        <div class="barcode-input-container">
          <form @submit.prevent="submitBarcode" class="barcode-form">
            <div class="input-group">
              <input
                type="text"
                v-model="barcode"
                id="barcode_input"
                ref="barcodeInput"
                autocomplete="off"
                placeholder="Enter or scan a barcode..."
                :disabled="scannerMode"
              />
              <button
                type="button"
                @click="toggleScannerMode"
                class="camera-button"
                :class="{ active: scannerMode }"
              >
                <span v-if="scannerMode">❌</span>
                <span v-else>📷</span>
              </button>
              <button type="submit" :disabled="scannerMode">Submit</button>
            </div>
          </form>
        </div>

        <!-- Scanner and latest scan in a flex container for desktop -->
        <div v-if="scannerMode" class="scanner-with-results">
          <div class="scanner-panel">
            <BarcodeScanner @barcode-detected="onBarcodeDetected" />
            <div class="scanner-help-text">
              <p>Point your camera at a barcode to scan it automatically.</p>
            </div>
          </div>

          <div v-if="latestItem" class="latest-scan-panel">
            <h3>Latest Scan</h3>
            <InventoryItem
              :item="latestItem"
              :index="0"
              :isExpanded="true"
              @toggleExpand="() => {}"
              :fetchAuthorizedValues="fetchAuthorizedValues"
              :sessionData="sessionData"
              :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
              :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber"
              :alert-settings="alertSettings"
            />
          </div>
        </div>

        <!-- Manual mode - full width layout -->
        <div v-if="!scannerMode" class="manual-mode-results">
          <div v-if="latestItem" class="latest-scan-panel">
            <h3>Latest Scan</h3>
            <InventoryItem
              :item="latestItem"
              :index="0"
              :isExpanded="true"
              @toggleExpand="() => {}"
              :fetchAuthorizedValues="fetchAuthorizedValues"
              :sessionData="sessionData"
              :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
              :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber"
              :alert-settings="alertSettings"
            />
          </div>

          <div id="inventory_results" class="items-list">
            <h3>Previous Scans</h3>
            <p v-if="previousItems.length === 0" class="no-items-message">No previous scans yet.</p>
            <InventoryItem
              v-for="(item, index) in previousItems"
              :key="`${index}-${item.id}`"
              :item="item"
              :index="index + 1"
              :isExpanded="item.isExpanded"
              @toggleExpand="handleToggleExpand"
              :fetchAuthorizedValues="fetchAuthorizedValues"
              :sessionData="sessionData"
              :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
              :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber"
              :alert-settings="alertSettings"
            />
          </div>
        </div>

        <!-- Only show this in scanner mode -->
        <div v-if="scannerMode" class="result-panel">
          <div id="inventory_results" class="items-list">
            <h3>Previous Scans</h3>
            <p v-if="previousItems.length === 0" class="no-items-message">No previous scans yet.</p>
            <InventoryItem
              v-for="(item, index) in previousItems"
              :key="`${index}-${item.id}`"
              :item="item"
              :index="index + 1"
              :isExpanded="item.isExpanded"
              @toggleExpand="handleToggleExpand"
              :fetchAuthorizedValues="fetchAuthorizedValues"
              :sessionData="sessionData"
              :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
              :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber"
              :alert-settings="alertSettings"
            />
          </div>
        </div>
      </div>
    </div>
    <button
      v-if="sessionStarted && !sessionInitializing"
      @click="toggleEndSessionModal"
      class="end-session-button"
    >
      End Session
    </button>
    <button
      v-if="sessionStarted && !sessionInitializing"
      @click="toggleMissingItemsModal"
      class="missing-items-button"
    >
      Dashboard
      <span v-if="getMissingItemsCount() > 0" class="missing-count">{{
        getMissingItemsCount()
      }}</span>
    </button>
    <button
      v-if="sessionStarted && !sessionInitializing && previewEnabled"
      @click="toggleShelfPreview"
      class="shelf-preview-button"
    >
      Shelf Preview
      <span v-if="upcomingItemsCount > 0" class="upcoming-count">{{ upcomingItemsCount }}</span>
    </button>

    <!-- End Session Modal -->
    <div v-if="showEndSessionModal" class="modal">
      <div class="modal-content">
        <span @click="showEndSessionModal = false" class="close">&times;</span>
        <h2>End Session</h2>
        <p v-if="uniqueBarcodesCount <= expectedUniqueBarcodes">
          Scanned {{ uniqueBarcodesCount }} unique barcodes of an expected
          {{ expectedUniqueBarcodes }} are you sure you want to end the session?
        </p>
        <div class="modal-checkboxes">
          <input type="checkbox" id="exportToCSV" v-model="exportToCSV" /> Export to CSV
        </div>
        <div class="modal-checkboxes">
          <input
            type="checkbox"
            id="exportMissingOnly"
            v-model="exportMissingOnly"
            v-if="exportToCSV"
          />
          Export missing items only (items not scanned)
        </div>
        <div class="modal-checkboxes">
          <input type="checkbox" v-model="markMissingItems" id="mark-missing-items" /> Mark
          "loststatus" as missing for any expected items not scanned
        </div>
        <span v-if="markMissingItems" style="color: red"
          >(This can take a while for large numbers of missing items)</span
        >
        <button @click="endSession" class="end-session-modal-button">End Session</button>
      </div>
    </div>

    <!-- Resolution Modals -->
    <ResolutionModal
      v-if="showResolutionModal"
      :show="showResolutionModal"
      :item="currentResolutionItem"
      :type="currentResolutionType"
      :patronName="currentPatronName"
      @close="closeResolutionModal"
      @resolved="handleResolutionComplete"
    />

    <!-- Missing Items Modal -->
    <MissingItemsModal
      v-if="showMissingItemsModal"
      :sessionData="sessionData"
      :scannedItems="items"
      @close="toggleMissingItemsModal"
      @missing-items-updated="handleMissingItemsUpdated"
    ></MissingItemsModal>

    <!-- Shelf Preview Component -->
    <ShelfPreview
      v-if="showShelfPreview"
      :show="showShelfPreview"
      :sessionData="sessionData"
      :lastScannedItem="latestItem"
      :authorizedValueCategories="authorizedValueCategories"
      @close="closeShelfPreview"
      @items-loaded="handleUpcomingItemsLoaded"
    />
  </div>
</template>

<script>
import InventorySetupForm from './InventorySetupForm.vue'
import InventoryItem from './InventoryItem.vue'
import BarcodeScanner from './BarcodeScanner.vue'
import ResolutionModal from './ResolutionModal.vue'
import MissingItemsModal from './MissingItemsModal.vue'
import ShelfPreview from './ShelfPreview.vue'
import { EventBus } from './eventBus'
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
import { apiService } from '../services/apiService'

export default {
  components: {
    InventorySetupForm,
    InventoryItem,
    BarcodeScanner,
    ResolutionModal,
    MissingItemsModal,
    ShelfPreview
  },
  computed: {
    uniqueBarcodesCount() {
      const uniqueBarcodes = new Set(this.items.map((item) => item.external_id))
      return uniqueBarcodes.size
    },
    expectedUniqueBarcodes() {
      return this.sessionData && this.sessionData.response_data
        ? this.sessionData.response_data.total_records || 0
        : 0
    },
    latestItem() {
      return this.items.length > 0 ? this.items[0] : null
    },
    previousItems() {
      return this.items.slice(1)
    },
    previewEnabled() {
      return this.sessionData?.previewSettings?.enableShelfPreview !== false
    }
  },
  data() {
    return {
      barcode: '',
      scannerMode: false,
      items: [],
      sessionData: null,
      sessionStarted: false,
      sessionInitializing: false,
      highestCallNumberSort: '',
      itemWithHighestCallNumber: '',
      biblioWithHighestCallNumber: null,
      showEndSessionModal: false,
      exportToCSV: false,
      exportMissingOnly: false,
      markMissingItems: false,
      isMobileView: false,
      skipCheckedOutItems: true,
      skipInTransitItems: false,
      skipBranchMismatchItems: false,
      compareBarcodes: false,
      locationCode: '',
      rightPlaceList: [],
      alertSettings: {
        showWithdrawnAlerts: true,
        showOnHoldAlerts: true,
        showInTransitAlerts: true,
        showBranchMismatchAlerts: true,
        showReturnClaimAlerts: true
      },
      session_id: '',
      inventoryDate: '',
      currentLibrary: '',
      shelvingLocation: '',
      doNotCheckIn: false,
      checkShelvedOutOfOrder: false,
      statuses: {},
      locations: {},
      resolutionSettings: {
        resolveReturnClaims: false,
        resolveInTransitItems: false,
        resolveWithdrawnItems: false,
        resolveLostItems: false
      },
      showResolutionModal: false,
      showMissingItemsModal: false,
      showShelfPreview: false,
      currentResolutionItem: null,
      currentResolutionType: '',
      currentPatronName: '',
      manualResolutionEnabled: true,
      markedMissingItems: new Set(),
      upcomingItemsCount: 0,
      authorizedValueCategories: {},
      showFilters: false
    }
  },
  mounted() {
    // Check for existing session on component mount
    this.checkForExistingSession()

    // Check if the user is on a mobile device
    this.checkDeviceType()

    // Add a resize listener to update the layout when window size changes
    window.addEventListener('resize', this.checkDeviceType)
  },

  beforeUnmount() {
    // Clean up the resize event listener
    window.removeEventListener('resize', this.checkDeviceType)
  },
  methods: {
    // Active filters display methods
    getLibraryName() {
      if (!this.sessionData?.selectedLibraryId) return 'All Libraries'
      // TODO: Enhancement - store library names in session data to show descriptions instead of codes
      return this.sessionData.selectedLibraryId
    },

    getShelvingLocationName() {
      if (!this.sessionData?.shelvingLocation) return 'All Locations'
      // TODO: Enhancement - store shelving location descriptions in session data to show names instead of codes
      return this.sessionData.shelvingLocation
    },

    getCollectionCodeName() {
      if (!this.sessionData?.ccode) return 'All Collections'
      // TODO: Enhancement - store collection code descriptions in session data to show names instead of codes
      return this.sessionData.ccode
    },

    getSelectedItemTypesText() {
      if (!this.sessionData?.selectedItypes?.length) return 'All Item Types'
      const count = this.sessionData.selectedItypes.length
      return count === 1 ? this.sessionData.selectedItypes[0] : `${count} selected`
    },

    getCallNumberRangeText() {
      if (!this.sessionData?.minLocation && !this.sessionData?.maxLocation) {
        return 'All Call Numbers'
      }
      if (this.sessionData.minLocation && this.sessionData.maxLocation) {
        return `${this.sessionData.minLocation} - ${this.sessionData.maxLocation}`
      }
      if (this.sessionData.minLocation) {
        return `From: ${this.sessionData.minLocation}`
      }
      return `To: ${this.sessionData.maxLocation}`
    },

    hasSkipFilters() {
      return (
        this.sessionData?.skipCheckedOutItems ||
        this.sessionData?.skipInTransitItems ||
        this.sessionData?.skipBranchMismatchItems ||
        this.sessionData?.ignoreWaitingHolds
      )
    },

    getSkipFiltersText() {
      const filters = []
      if (this.sessionData?.skipCheckedOutItems) filters.push('Checked out items')
      if (this.sessionData?.skipInTransitItems) filters.push('In-transit items')
      if (this.sessionData?.skipBranchMismatchItems) filters.push('Branch mismatch items')
      if (this.sessionData?.ignoreWaitingHolds) filters.push('Items on hold')
      return filters.join(', ')
    },

    formatDate(dateString) {
      if (!dateString) return ''
      return new Date(dateString).toLocaleDateString()
    },

    toggleFiltersDisplay() {
      this.showFilters = !this.showFilters
    },

    getActiveFiltersCount() {
      let count = 5 // Always show: Library, Location, Collection, Call Numbers, Item Types

      // Add optional filters when they exist
      if (this.sessionData?.dateLastSeen) count++
      if (this.hasSkipFilters()) count++
      count++ // Always count the scanning mode

      return count
    },
    // Transit status analysis methods
    getTransitInfo(item) {
      if (!item.transfer) {
        return {
          inTransit: false,
          type: null,
          reason: null,
          isHoldTransit: false,
          isReturnTransit: false,
          isManualTransit: false,
          from: null,
          to: null,
          date: null
        }
      }

      const reason = item.transfer.reason
      const type = this.getTransitType(reason)

      return {
        inTransit: true,
        reason,
        type,
        from: item.transfer.frombranch,
        to: item.transfer.tobranch,
        date: item.transfer.datesent,
        isHoldTransit: reason === 'Reserve',
        isReturnTransit: ['ReturnToHome', 'ReturnToHolding'].includes(reason),
        isManualTransit: reason === 'Manual',
        isStockrotationTransit: ['StockrotationAdvance', 'StockrotationRepatriation'].includes(
          reason
        ),
        isCollectionTransit: reason === 'RotatingCollection',
        isRecallTransit: reason === 'Recall'
      }
    },

    getTransitType(reason) {
      const typeMap = {
        Reserve: 'hold',
        ReturnToHome: 'return',
        ReturnToHolding: 'return',
        Manual: 'manual',
        StockrotationAdvance: 'stockrotation',
        StockrotationRepatriation: 'stockrotation',
        RotatingCollection: 'collection',
        Recall: 'recall',
        LostReserve: 'lost',
        CancelReserve: 'cancelled',
        RecallCancellation: 'cancelled'
      }
      return typeMap[reason] || 'other'
    },

    // Comprehensive status analysis system
    analyzeItemStatus(item) {
      return {
        checkout: this.analyzeCheckoutStatus(item),
        lost: this.analyzeLostStatus(item),
        withdrawn: this.analyzeWithdrawnStatus(item),
        damaged: this.analyzeDamagedStatus(item),
        hold: this.analyzeHoldStatus(item),
        transit: this.getTransitInfo(item),
        returnClaim: this.analyzeReturnClaimStatus(item),
        branch: this.analyzeBranchStatus(item),
        restrictions: this.analyzeRestrictions(item)
      }
    },

    analyzeCheckoutStatus(item) {
      return {
        isCheckedOut: !!item.checked_out_date,
        checkoutDate: item.checked_out_date,
        dueDate: item.due_date,
        isOverdue: item.due_date && new Date(item.due_date) < new Date()
      }
    },

    analyzeLostStatus(item) {
      const isLost = item.lost_status && item.lost_status !== '0'
      return {
        isLost,
        lostStatus: item.lost_status,
        lostDate: item.lost_date,
        lostDescription: isLost ? this.getLostDescription(item.lost_status) : null
      }
    },

    analyzeWithdrawnStatus(item) {
      const isWithdrawn = item.withdrawn === '1' || item.withdrawn === 1
      return {
        isWithdrawn,
        withdrawnStatus: item.withdrawn,
        withdrawnDate: item.withdrawn_date
      }
    },

    analyzeDamagedStatus(item) {
      const isDamaged = item.damaged_status && item.damaged_status !== '0'
      return {
        isDamaged,
        damagedStatus: item.damaged_status,
        damagedDate: item.damaged_date
      }
    },

    analyzeHoldStatus(item) {
      return {
        hasHold: !!item.first_hold,
        isWaiting: !!item.waiting,
        holdDetails: item.first_hold
      }
    },

    analyzeReturnClaimStatus(item) {
      return {
        hasReturnClaim: !!item.return_claim,
        claimDetails: item.return_claim,
        claimsCount: Array.isArray(item.return_claims) ? item.return_claims.length : 0
      }
    },

    analyzeBranchStatus(item) {
      const hasBranchMismatch = item.homebranch !== item.holding_library_id
      return {
        hasBranchMismatch,
        homeBranch: item.homebranch,
        holdingBranch: item.holding_library_id,
        needsTransfer: hasBranchMismatch && !item.checked_out_date
      }
    },

    analyzeRestrictions(item) {
      return {
        isRestricted: item.restricted_status && item.restricted_status !== '0',
        restrictedStatus: item.restricted_status,
        notForLoan: item.not_for_loan_status && item.not_for_loan_status !== 0,
        notForLoanStatus: item.not_for_loan_status
      }
    },

    getLostDescription(lostStatus) {
      // This could be enhanced to fetch authorized values
      const lostDescriptions = {
        1: 'Lost',
        2: 'Long Overdue (Lost)',
        3: 'Lost and Paid For',
        4: 'Missing'
      }
      return lostDescriptions[lostStatus] || `Lost Status: ${lostStatus}`
    },

    // Helper method to get all problematic statuses that need attention
    getProblematicStatuses(statusAnalysis) {
      const issues = []

      if (statusAnalysis.checkout.isOverdue) {
        issues.push({ type: 'overdue', severity: 'high', message: 'Item is overdue' })
      }

      if (statusAnalysis.lost.isLost) {
        issues.push({
          type: 'lost',
          severity: 'high',
          message: statusAnalysis.lost.lostDescription
        })
      }

      if (statusAnalysis.withdrawn.isWithdrawn) {
        issues.push({ type: 'withdrawn', severity: 'medium', message: 'Item is withdrawn' })
      }

      if (statusAnalysis.damaged.isDamaged) {
        issues.push({ type: 'damaged', severity: 'medium', message: 'Item is damaged' })
      }

      if (statusAnalysis.returnClaim.hasReturnClaim) {
        issues.push({
          type: 'return_claim',
          severity: 'high',
          message: 'Item has unresolved return claim'
        })
      }

      if (statusAnalysis.transit.inTransit) {
        const transitMsg = `Item in transit ${this.getTransitDescription ? this.getTransitDescription(statusAnalysis.transit) : ''}`
        issues.push({ type: 'transit', severity: 'low', message: transitMsg })
      }

      if (statusAnalysis.branch.hasBranchMismatch && !statusAnalysis.checkout.isCheckedOut) {
        issues.push({
          type: 'branch_mismatch',
          severity: 'medium',
          message: 'Item at wrong branch'
        })
      }

      if (statusAnalysis.hold.hasHold && statusAnalysis.hold.isWaiting) {
        issues.push({
          type: 'waiting_hold',
          severity: 'high',
          message: 'Item has hold waiting for pickup'
        })
      }

      return issues.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 }
        return severityOrder[b.severity] - severityOrder[a.severity]
      })
    },

    // Handle individual item issues based on type and settings
    async handleItemIssue(item, issue, statusAnalysis) {
      const resolutionKey = this.getResolutionSettingKey(issue.type)
      const shouldAutoResolve = resolutionKey && this.resolutionSettings[resolutionKey]

      if (!shouldAutoResolve) {
        // Show manual resolution modal
        const modalType = this.getModalType(issue.type)
        if (modalType) {
          this.openResolutionModal(item, modalType)
          return true // Indicates manual resolution is needed
        }
      }

      return false // Continue processing
    },

    getResolutionSettingKey(issueType) {
      const settingMap = {
        lost: 'resolveLostItems',
        withdrawn: 'resolveWithdrawnItems',
        transit: 'resolveInTransitItems',
        return_claim: 'resolveReturnClaims'
      }
      return settingMap[issueType]
    },

    getModalType(issueType) {
      const modalMap = {
        lost: 'lost',
        withdrawn: 'withdrawn',
        transit: 'intransit',
        return_claim: 'returnclaim'
      }
      return modalMap[issueType]
    },

    // Proper call number comparison following Koha core logic
    isCallNumberOutOfOrder(currentCallNumberSort, highestCallNumberSort) {
      // Handle empty/null values - items without call numbers are not considered out of order
      if (!currentCallNumberSort || !highestCallNumberSort) {
        return false
      }

      // Use lexicographic comparison like Koha core (cn_sort lt/gt)
      // In JavaScript, this is equivalent to localeCompare < 0
      return currentCallNumberSort < highestCallNumberSort
    },

    checkForExistingSession() {
      if (isSessionActive()) {
        // Chain promises instead of using async/await
        getSession()
          .then((savedSessionData) => {
            if (savedSessionData) {
              this.sessionData = savedSessionData
              this.sessionStarted = true

              // Get saved items
              return getItems().then((savedItems) => {
                if (savedItems) {
                  this.items = savedItems
                  // Restore the highest call number tracking
                  this.updateHighestCallNumber()
                }
                return getMarkedMissingItems()
              })
            }
            return Promise.reject('No saved session data found')
          })
          .then((savedMarkedMissingItems) => {
            // Restore marked missing items if available
            if (savedMarkedMissingItems && Array.isArray(savedMarkedMissingItems)) {
              this.markedMissingItems = new Set(savedMarkedMissingItems)
            }

            EventBus.emit('message', { text: 'Session restored successfully', type: 'status' })

            // Focus on barcode input after a short delay to ensure the DOM is ready
            this.$nextTick(() => {
              if (this.$refs.barcodeInput) {
                this.$refs.barcodeInput.focus()
              }
            })
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
        // Only load form data if we're showing the form (no active session)
        this.$nextTick(() => {
          if (this.$refs.setupForm) {
            this.$refs.setupForm.loadFormData()
          }
        })
      }
    },

    updateHighestCallNumber() {
      // Find the item with the highest call number sort value
      if (this.items.length > 0) {
        let highestSortValue = ''
        let highestItemBarcode = ''
        let highestBiblioId = ''

        this.items.forEach((item) => {
          const itemCallNumberSort = item.call_number_sort || ''
          // Use proper string comparison for call number sorting
          if (itemCallNumberSort && itemCallNumberSort > highestSortValue) {
            highestSortValue = itemCallNumberSort
            highestItemBarcode = item.external_id
            highestBiblioId = item.biblio_id
          }
        })

        this.highestCallNumberSort = highestSortValue
        this.itemWithHighestCallNumber = highestItemBarcode
        this.biblioWithHighestCallNumber = highestBiblioId || null
      }
    },

    async endSession() {
      try {
        let operationsCompleted = false

        // Disable the button to prevent multiple clicks during processing
        const endSessionButton = document.querySelector('.end-session-modal-button')
        if (endSessionButton) {
          endSessionButton.disabled = true
          endSessionButton.textContent = 'Processing...'
        }

        if (this.exportToCSV) {
          // Export to CSV first
          await this.exportDataToCSV()
        }

        if (this.markMissingItems) {
          // Add defensive check for location_data
          const locationData = this.sessionData.response_data.location_data || []
          const scannedBarcodesSet = new Set(this.items.map((item) => item.external_id))

          // Filter out items that are checked out if skipCheckedOutItems is enabled
          const missingItems = locationData.filter((item) => {
            // Skip items that have already been scanned
            if (scannedBarcodesSet.has(item.barcode)) {
              return false
            }

            // Skip items that have already been marked as missing
            if (this.markedMissingItems.has(item.barcode)) {
              return false
            }

            if (item.checked_out_date) {
              return false
            }

            // Skip items that are in transit if the session is configured to do so
            if (this.sessionData.skipInTransitItems && item.in_transit) {
              return false
            }

            // Skip items that have branch mismatch if the session is configured to do so
            if (
              this.sessionData.skipBranchMismatchItems &&
              item.homebranch !== item.holdingbranch
            ) {
              return false
            }

            return true
          })

          if (missingItems.length > 0) {
            // Show processing message
            EventBus.emit('message', {
              text: `Processing ${missingItems.length} missing items...`,
              type: 'status'
            })

            // Mark missing items
            const itemsToUpdate = missingItems.map((item) => ({
              barcode: item.barcode,
              fields: { itemlost: 4 }
            }))

            try {
              // Wait for the update to complete
              await this.updateItemStatus(itemsToUpdate)

              // Add all marked items to our tracking set
              itemsToUpdate.forEach((item) => this.markedMissingItems.add(item.barcode))

              // Signal completion
              EventBus.emit('message', {
                text: 'Items marked as missing successfully',
                type: 'status'
              })

              // Count skipped items
              let skippedCheckedOut = 0
              let skippedInTransit = 0
              let skippedBranchMismatch = 0

              locationData.forEach((item) => {
                if (!scannedBarcodesSet.has(item.barcode) && !missingItems.includes(item)) {
                  if (this.sessionData.skipCheckedOutItems && item.checked_out) {
                    skippedCheckedOut++
                  } else if (this.sessionData.skipInTransitItems && item.in_transit) {
                    skippedInTransit++
                  } else if (
                    this.sessionData.skipBranchMismatchItems &&
                    item.homebranch !== item.holdingbranch
                  ) {
                    skippedBranchMismatch++
                  }
                }
              })

              // Show summary of skipped items
              if (skippedCheckedOut > 0) {
                EventBus.emit('message', {
                  text: `${skippedCheckedOut} checked out items were skipped from being marked as missing`,
                  type: 'status'
                })
              }

              if (skippedInTransit > 0) {
                EventBus.emit('message', {
                  text: `${skippedInTransit} in-transit items were skipped from being marked as missing`,
                  type: 'status'
                })
              }

              if (skippedBranchMismatch > 0) {
                EventBus.emit('message', {
                  text: `${skippedBranchMismatch} items with branch mismatch were skipped from being marked as missing`,
                  type: 'status'
                })
              }
            } catch (error) {
              EventBus.emit('message', {
                text: `Error marking items as missing: ${error.message}`,
                type: 'error'
              })
              throw error // Re-throw to prevent page reload if marking items fails
            }
          } else {
            EventBus.emit('message', { text: 'No missing items to mark', type: 'status' })
          }
        }

        // Mark operations as completed
        operationsCompleted = true

        // Clear session storage
        clearSession()

        // Close the modal
        this.showEndSessionModal = false

        // Reset component state
        this.sessionStarted = false
        this.sessionData = null
        this.items = []
        this.markedMissingItems = new Set()

        // Wait a moment to make sure the user sees the success message
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Reload the page to start fresh
        window.location.reload()
      } catch (error) {
        // Re-enable the button on error
        const endSessionButton = document.querySelector('.end-session-modal-button')
        if (endSessionButton) {
          endSessionButton.disabled = false
          endSessionButton.textContent = 'End Session'
        }

        EventBus.emit('message', { text: `Error ending session: ${error.message}`, type: 'error' })
      }
    },

    async updateItemStatus(items = []) {
      if (!items || items.length === 0) {
        return // No items to update
      }

      try {
        // Add progress indicator for large batches
        if (items.length > 50) {
          EventBus.emit('message', {
            text: `Processing ${items.length} items, please wait...`,
            type: 'status'
          })
        }

        // Use the improved apiService instead of direct fetch
        const data = await apiService.post(`/api/v1/contrib/interactiveinventory/item/fields`, {
          items
        })

        return data // Return the response data
      } catch (error) {
        console.error('Error updating item statuses:', error)
        EventBus.emit('message', {
          text: `Error updating item statuses: ${error.message}`,
          type: 'error'
        })
        throw error // Re-throw the error to be handled by the caller
      }
    },

    async fetchAuthorizedValues(category, options = {}) {
      try {
        // If we're in an active session, handle differently for efficiency
        if (this.sessionStarted && !options.forceLoad) {
          const cacheKey = `authorizedValues_${category}`
          const cachedValues = localStorage.getItem(cacheKey)

          if (cachedValues) {
            const parsedValues = JSON.parse(cachedValues)
            if (options.onValuesUpdate) {
              options.onValuesUpdate(parsedValues)
            }
            return parsedValues
          }

          // In scanner mode, just return empty object if no cache to avoid API call
          return {}
        }

        // Otherwise proceed with normal implementation for setup form
        const combinedOptions = {
          ...options,
          onProgress: (progress) => {
            if (progress.loaded % 100 === 0 || progress.loaded === progress.total) {
              EventBus.emit('message', {
                type: 'status',
                text: `Loading ${category} values: ${progress.loaded}${progress.total ? '/' + progress.total : ''}`
              })
            }
          }
        }

        // First check if we have cached values
        const cacheKey = `authorizedValues_${category}`
        const cachedValues = localStorage.getItem(cacheKey)

        if (cachedValues && !options.bypassCache) {
          try {
            const parsedValues = JSON.parse(cachedValues)
            if (options.onValuesUpdate) {
              options.onValuesUpdate(parsedValues)
            }
            return parsedValues
          } catch (e) {
            console.error(`Error parsing cached authorized values for ${category}:`, e)
            // Continue with API call if parsing fails
          }
        }

        return await apiService.fetchAuthorizedValues(category, combinedOptions)
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Error fetching authorized values: ${error.message}`
        })
        throw error
      }
    },

    async submitBarcode() {
      if (!this.barcode) {
        return
      }

      if (this.loading) {
        return
      }

      // Trim whitespace from barcode
      this.barcode = this.barcode.trim()

      // Exit early if barcode is empty after trimming
      if (!this.barcode) {
        return
      }

      this.loading = true
      this.lastScannedBarcode = this.barcode

      try {
        EventBus.emit('message', { type: 'status', text: 'Searching for item...' })

        // Fetch item with embedded biblio data in a single API call
        let response = await fetch(
          `/api/v1/items?external_id=${encodeURIComponent(this.barcode)}`,
          {
            headers: {
              Accept: 'application/json',
              'x-koha-embed': 'biblio'
            }
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.statusText}`)
        }

        const items = await response.json()

        if (!items || items.length === 0) {
          throw new Error('Item not found: ' + this.barcode)
        }

        // Item data now includes embedded biblio data
        const combinedData = items[0]

        if (!combinedData.biblio) {
          throw new Error('Item found but missing embedded biblio data: ' + this.barcode)
        }

        // Check if the item is checked out and the user has chosen to skip checked out items
        if (this.sessionData.skipCheckedOutItems && combinedData.checked_out_date) {
          EventBus.emit('message', {
            type: 'warning',
            text: `Item ${this.barcode} is currently checked out. Skipping according to settings.`
          })

          // Clear the barcode input and focus on it
          this.barcode = ''
          if (this.$refs.barcodeInput) {
            this.$refs.barcodeInput.focus()
          }

          this.loading = false
          return // Skip processing this item
        }

        // Check if the item is in transit and the user has chosen to skip in-transit items
        if (this.sessionData.skipInTransitItems && combinedData.in_transit) {
          EventBus.emit('message', {
            type: 'warning',
            text: `Item ${this.barcode} is currently in transit. Skipping according to settings.`
          })

          // Clear the barcode input and focus on it
          this.barcode = ''
          if (this.$refs.barcodeInput) {
            this.$refs.barcodeInput.focus()
          }

          this.loading = false
          return // Skip processing this item
        }

        // Check if the item has branch mismatch and the user has chosen to skip such items
        if (
          this.sessionData.skipBranchMismatchItems &&
          combinedData.homebranch !== combinedData.holdingbranch
        ) {
          EventBus.emit('message', {
            type: 'warning',
            text: `Item ${this.barcode} has different holding branch (${combinedData.holdingbranch}) than home branch (${combinedData.homebranch}). Skipping according to settings.`
          })

          // Clear the barcode input and focus on it
          this.barcode = ''
          if (this.$refs.barcodeInput) {
            this.$refs.barcodeInput.focus()
          }

          this.loading = false
          return // Skip processing this item
        }

        // Data is already combined with embedded biblio from the single API call

        // Analyze comprehensive item status
        const statusAnalysis = this.analyzeItemStatus(combinedData)
        combinedData.statusAnalysis = statusAnalysis

        // Add running 'fields to amend' variable
        var fieldsToAmend = {}

        if (this.sessionData.inventoryDate > combinedData.last_seen_date) {
          fieldsToAmend['datelastseen'] = this.sessionData.inventoryDate
        }

        // Check various status flags
        this.checkItemSpecialStatuses(combinedData)

        // Check for issues that might need manual resolution
        if (this.manualResolutionEnabled) {
          // Handle checked out items
          if (combinedData.checked_out_date) {
            // Get patron information if possible
            let patronName = 'Unknown Patron'
            if (combinedData.checkout && combinedData.checkout.patron_id) {
              try {
                const patronResponse = await fetch(
                  `/api/v1/patrons/${combinedData.checkout.patron_id}`,
                  {
                    headers: {
                      Accept: 'application/json'
                    }
                  }
                )

                if (patronResponse.ok) {
                  const patronData = await patronResponse.json()
                  patronName = `${patronData.firstname} ${patronData.surname}`
                }
              } catch (error) {
                console.error('Error fetching patron details:', error)
              }
            }

            // Show the resolution modal for checked out items
            this.openResolutionModal(combinedData, 'checkedout', patronName)
            this.barcode = ''
            this.loading = false
            return
          }

          // Check for issues that require resolution
          const issues = this.getProblematicStatuses(statusAnalysis)
          const highPriorityIssues = issues.filter((issue) => issue.severity === 'high')

          // Handle each type of issue
          for (const issue of highPriorityIssues) {
            if (await this.handleItemIssue(combinedData, issue, statusAnalysis)) {
              this.barcode = ''
              this.loading = false
              return // Stop processing if manual resolution is needed
            }
          }
        }

        // If we get here, proceed with automatic resolution or normal processing

        // Check if item has a return claim and should be resolved
        if (combinedData.return_claim && this.resolutionSettings.resolveReturnClaims) {
          const claimResolved = await this.resolveReturnClaim(combinedData.external_id)
          if (claimResolved) {
            combinedData.return_claim = false
            // Add resolution flags for display
            combinedData.resolutionType = 'returnclaim'
            combinedData.resolutionAction = 'claim resolved'
            combinedData.pendingResolution = false

            EventBus.emit('message', {
              type: 'success',
              text: `Return claim resolved for ${combinedData.external_id}`
            })
          }
        }

        // Check if item is in transit and should be resolved
        const transitInfo = this.getTransitInfo(combinedData)
        if (transitInfo.inTransit && this.resolutionSettings.resolveInTransitItems) {
          const transitResolved = await this.resolveTransit(combinedData.external_id)
          if (transitResolved) {
            combinedData.in_transit = false
            // Add resolution flags for display with detailed transit info
            combinedData.resolutionType = 'intransit'
            combinedData.resolutionAction = 'transit resolved'
            combinedData.pendingResolution = false
            combinedData.transitInfo = { ...transitInfo, inTransit: false }

            // Emit success message with specific transit type details
            const transitTypeMsg = transitInfo.isHoldTransit
              ? ' (hold transit)'
              : transitInfo.isReturnTransit
                ? ' (return transit)'
                : transitInfo.isManualTransit
                  ? ' (manual transit)'
                  : ''
            EventBus.emit('message', {
              type: 'success',
              text: `In-transit status resolved for ${combinedData.external_id}${transitTypeMsg}`
            })
          }
        }

        // Check if item is withdrawn and should be automatically restored
        if (
          (combinedData.withdrawn === '1' || combinedData.withdrawn === 1) &&
          this.resolutionSettings.resolveWithdrawnItems
        ) {
          // Store the original withdrawn status for reference
          combinedData.originalWithdrawnStatus = combinedData.withdrawn

          // Update the withdrawn status in the system
          const fieldsToUpdate = { withdrawn: '0' }
          const withdrawnResolved = await this.updateSingleItemStatus(
            combinedData.external_id,
            fieldsToUpdate
          )

          if (withdrawnResolved) {
            // Clear withdrawn status in the UI data
            combinedData.withdrawn = '0'
            combinedData.wasWithdrawn = true // Keep track that it was withdrawn

            // Add resolution flags for display
            combinedData.resolutionType = 'withdrawn'
            combinedData.resolutionAction = 'automatically restored'
            combinedData.pendingResolution = false

            EventBus.emit('message', {
              type: 'success',
              text: `Withdrawn status removed for ${combinedData.external_id}`
            })
          }
        }

        // Check if item is lost and should be automatically marked as found
        if (
          combinedData.lost_status !== '0' &&
          combinedData.lost_status &&
          this.resolutionSettings.resolveLostItems
        ) {
          // Store the original lost status for reference and display
          combinedData.originalLostStatus = combinedData.lost_status

          // Update the lost status in the system
          // Update the lost status
          const fieldsToUpdate = { itemlost: '0' }
          const lostResolved = await this.updateSingleItemStatus(
            combinedData.external_id,
            fieldsToUpdate
          )

          if (lostResolved) {
            // We don't clear lost_status in the UI data to preserve the reason for display
            // combinedData.lost_status = '0';
            combinedData.wasLost = true // Keep track that it was lost

            // Add resolution flags for display
            combinedData.resolutionType = 'lost'
            combinedData.resolutionAction = 'automatically found'
            combinedData.pendingResolution = false

            EventBus.emit('message', {
              type: 'success',
              text: `Item ${combinedData.external_id} marked as found (was lost)`
            })
          } else {
          }
        }

        // Only check scanned barcodes against expected list if compareBarcodes is enabled
        if (this.sessionData.compareBarcodes) {
          // Add defensive check before accessing right_place_list
          const rightPlaceList = this.sessionData.response_data.right_place_list || []
          const isInRightPlaceList = rightPlaceList.some(
            (item) => item.barcode === combinedData.external_id
          )
          if (!isInRightPlaceList) {
            combinedData.wrongPlace = true // Flag the item as in the wrong place
            EventBus.emit('message', {
              type: 'warning',
              text: `Item ${combinedData.external_id} is not in the expected barcodes list`
            })
          } else {
            EventBus.emit('message', {
              type: 'status',
              text: `Item ${combinedData.external_id} found in expected barcodes list`
            })
          }
        }

        if (combinedData.checked_out_date && !this.sessionData.doNotCheckIn) {
          const checkInResult = await this.checkInItem(combinedData.external_id)
          // Add resolution flags for display since item was automatically checked in
          combinedData.resolutionType = 'checkedout'
          combinedData.resolutionAction = 'checked in'
          combinedData.pendingResolution = false

          // Store transit information if present
          if (checkInResult && checkInResult.needs_transfer) {
            combinedData.needs_transfer = true
            combinedData.transfer_to = checkInResult.transfer_to
          }
        }

        // Check if the item is marked as lost and update its status
        // This legacy code path should only run if we aren't using the new resolution process
        if (
          combinedData.lost_status !== '0' &&
          combinedData.lost_status &&
          !this.resolutionSettings.resolveLostItems &&
          !this.manualResolutionEnabled
        ) {
          combinedData.wasLost = true // Flag the item as previously lost
          // Add the key-value pair to the fields to amend object
          fieldsToAmend['itemlost'] = '0'
          // Add resolution flags for display since lost status is automatically cleared
          combinedData.resolutionType = 'lost'
          combinedData.resolutionAction = 'marked found'
          combinedData.pendingResolution = false
        }

        if (
          this.sessionData.checkShelvedOutOfOrder &&
          this.isCallNumberOutOfOrder(combinedData.call_number_sort, this.highestCallNumberSort)
        ) {
          combinedData.outOfOrder = true
        } else {
          this.highestCallNumberSort = combinedData.call_number_sort || ''
          this.itemWithHighestCallNumber = combinedData.external_id
          this.biblioWithHighestCallNumber = combinedData.biblio_id || null
        }

        if (
          this.sessionData.selectedStatuses &&
          Object.values(this.sessionData.selectedStatuses).some(
            (statusArray) => statusArray.length > 0
          )
        ) {
          this.checkItemStatuses(combinedData, this.sessionData.selectedStatuses)
        }

        combinedData.wasScanned = true

        // Prepend the combined data to the items array
        this.items.unshift(combinedData)

        // Set all items to be collapsed except the first one
        this.items = this.items.map((item, index) => ({
          ...item,
          isExpanded: index === 0 // Only expand the first item
        }))

        // Update the item status - using the single item endpoint
        if (Object.keys(fieldsToAmend).length > 0) {
          await this.updateSingleItemStatus(combinedData.external_id, fieldsToAmend)
        }

        // Save updated items to session storage
        saveItems(this.items)

        // Auto-open preview on first scan if enabled
        if (
          this.items.length === 1 &&
          this.sessionData?.previewSettings?.autoOpenPreview &&
          this.previewEnabled
        ) {
          this.showShelfPreview = true
          this.loadAuthorizedValueCategories()
        }

        // Clear the barcode input and focus on it
        this.barcode = ''
        if (this.$refs.barcodeInput) {
          this.$refs.barcodeInput.focus()
        }

        EventBus.emit('message', { type: 'status', text: 'Item scanned successfully' })
      } catch (error) {
        console.error(error)
        EventBus.emit('message', {
          text: `Error scanning barcode: ${error.message}`,
          type: 'error'
        })
      } finally {
        this.loading = false
      }
    },

    async checkInItem(barcode) {
      try {
        const data = await apiService.post(`/api/v1/contrib/interactiveinventory/item/checkin`, {
          barcode: barcode,
          date: this.sessionData.inventoryDate
        })

        let message = 'Item checked in successfully'
        if (data.needs_transfer) {
          message = `Item checked in and needs transfer to ${data.transfer_to}. Please initiate transfer process.`
        }
        EventBus.emit('message', { text: message, type: 'status' })
        return data
      } catch (error) {
        EventBus.emit('message', {
          text: `Error checking in item: ${error.message}`,
          type: 'error'
        })
        // Don't throw - we want to continue processing other items even if check-in fails
        return { error: error.message }
      }
    },

    async updateSingleItemStatus(barcode, fields) {
      try {
        // Use the improved apiService
        const data = await apiService.post(`/api/v1/contrib/interactiveinventory/item/field`, {
          barcode,
          fields
        })

        EventBus.emit('message', { text: 'Item status updated successfully', type: 'status' })
        return data
      } catch (error) {
        EventBus.emit('message', {
          text: `Error updating item status: ${error.message}`,
          type: 'error'
        })
        throw error
      }
    },

    async resolveReturnClaim(barcode) {
      this.loading = true

      try {
        EventBus.emit('message', {
          type: 'status',
          text: `Resolving return claim for item ${barcode}...`
        })

        // Get item details to find the claim ID
        const itemResponse = await fetch(
          `/api/v1/items?external_id=${encodeURIComponent(barcode)}`,
          {
            headers: { Accept: 'application/json' }
          }
        )

        if (!itemResponse.ok) {
          throw new Error(`Failed to fetch item: ${itemResponse.statusText}`)
        }

        const items = await itemResponse.json()
        if (!items || items.length === 0) {
          throw new Error(`Item not found with barcode: ${barcode}`)
        }

        const item = items[0]

        // Fetch unresolved claims for this item
        const claimsResponse = await fetch(
          `/api/v1/return_claims?q={"itemnumber":${item.item_id},"resolved":0}`,
          {
            headers: { Accept: 'application/json' }
          }
        )

        if (!claimsResponse.ok) {
          throw new Error(`Failed to fetch claims: ${claimsResponse.statusText}`)
        }

        const claims = await claimsResponse.json()
        if (!claims || claims.length === 0) {
          throw new Error('No unresolved claims found for this item')
        }

        // Resolve each claim
        for (const claim of claims) {
          const resolveResponse = await fetch(`/api/v1/return_claims/${claim.claim_id}/resolve`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              resolution: 'FOUND:INVENTORY',
              resolved_by: claim.created_by
            })
          })

          if (!resolveResponse.ok) {
            throw new Error(
              `Failed to resolve claim ${claim.claim_id}: ${resolveResponse.statusText}`
            )
          }
        }

        EventBus.emit('message', {
          type: 'success',
          text: `Return claim successfully resolved for ${barcode}`
        })
        this.loading = false
        return true
      } catch (error) {
        console.error('Error resolving return claim:', error)
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to resolve return claim: ${error.message}`
        })
        this.loading = false
        return false
      }
    },

    async resolveTransit(barcode) {
      try {
        EventBus.emit('message', {
          type: 'status',
          text: `Resolving in-transit status for item ${barcode}...`
        })

        const data = await apiService.post(
          `/api/v1/contrib/interactiveinventory/item/resolve_transit`,
          { barcode, branchCode: this.sessionData.selectedLibraryId || barcode.holdingbranch }
        )

        EventBus.emit('message', {
          type: 'success',
          text: `Successfully resolved in-transit status for item ${barcode}`
        })
        return data
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Error resolving in-transit status: ${error.message}`
        })
        // Don't throw so we continue with the item processing
        return { error: error.message }
      }
    },

    async initiateInventorySession(sessionData) {
      this.sessionData = sessionData
      this.sessionStarted = true
      this.sessionInitializing = true // Enable the loading indicator

      // Set the manual resolution setting from sessionData
      this.manualResolutionEnabled =
        sessionData.resolutionSettings?.enableManualResolution !== undefined
          ? sessionData.resolutionSettings.enableManualResolution
          : true

      // Initialize all resolution settings with defaults if not present
      this.resolutionSettings = {
        resolveReturnClaims: sessionData.resolutionSettings?.resolveReturnClaims || false,
        resolveInTransitItems: sessionData.resolutionSettings?.resolveInTransitItems || false,
        resolveWithdrawnItems: sessionData.resolutionSettings?.resolveWithdrawnItems || false,
        enableManualResolution: this.manualResolutionEnabled,
        resolveLostItems: sessionData.resolutionSettings?.resolveLostItems || false
      }

      // Log resolution settings for debugging

      // Log preview settings if present
      if (sessionData.previewSettings) {
      }

      // Display filter information to the user
      if (sessionData.shelvingLocation) {
        const locationName =
          sessionData.shelvingLocations &&
          sessionData.shelvingLocations[sessionData.shelvingLocation]
            ? sessionData.shelvingLocations[sessionData.shelvingLocation]
            : sessionData.shelvingLocation
        EventBus.emit('message', {
          type: 'status',
          text: `Applying shelving location filter: ${locationName}`
        })
      }

      // Display comparison mode
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

      // Make the API request with improved error handling
      fetch(
        `/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=start_session&session_data=${encodeURIComponent(JSON.stringify(sessionData))}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        }
      )
        .then((response) => {
          // Check for HTTP errors
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

          // Parse the JSON response with error handling
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
          // Validate response data
          if (!data) {
            throw new Error('Empty response received')
          }

          // Check for API error in the response
          if (data.error) {
            throw new Error(`API error: ${data.error}`)
          }

          // Validate expected data structure
          if (!data.location_data || !Array.isArray(data.location_data)) {
            console.warn('Invalid location_data in response:', data)
            data.location_data = []
          } else {
          }

          if (!data.right_place_list || !Array.isArray(data.right_place_list)) {
            console.warn('Invalid right_place_list in response:', data)
            data.right_place_list = []
          }

          this.sessionData.response_data = data

          // Save session data to session storage
          return saveSession(this.sessionData).catch((error) => {
            console.error('Inventory session error when saving session:', error)
            EventBus.emit('message', {
              text: `Error saving session data: ${error.message}. Try using fewer filters or a smaller item set.`,
              type: 'error'
            })
          })
        })
        .then(() => {
          // Clear any existing items
          this.items = []
          return saveItems(this.items).catch((error) => {
            console.error('Error saving empty items list:', error)
          })
        })
        .then(() => {
          // Provide information about expected barcodes list based on compareBarcodes setting
          if (this.sessionData.compareBarcodes) {
            const rightPlaceList = this.sessionData.response_data.right_place_list || []
            if (rightPlaceList.length > 0) {
              EventBus.emit('message', {
                text: `Expected barcodes list contains ${rightPlaceList.length} items. Items not on this list will be flagged.`,
                type: 'status'
              })

              // Check if collection code is used and provide additional info
              if (this.sessionData.ccode) {
                EventBus.emit('message', {
                  text: `Expected barcodes list is filtered by collection code: ${this.sessionData.ccode}`,
                  type: 'info'
                })
              }
            } else {
              // The list might be empty because of a collection code filter
              if (this.sessionData.ccode) {
                EventBus.emit('message', {
                  text: `Expected barcodes list is empty, possibly because of the collection code filter (${this.sessionData.ccode}). No items will be marked as unexpected.`,
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
            text: `Inventory session started with ${this.sessionData.response_data.total_records || 0} items`,
            type: 'status'
          })

          // Give a short delay before disabling the loading state to ensure everything is rendered
          setTimeout(() => {
            this.sessionInitializing = false

            // Focus on barcode input after initialization completes
            this.$nextTick(() => {
              if (this.$refs.barcodeInput) {
                this.$refs.barcodeInput.focus()
              }
            })
          }, 1000)
        })
        .catch((error) => {
          console.error('Inventory session error:', error)
          this.sessionStarted = false
          this.sessionData = null
          this.sessionInitializing = false

          EventBus.emit('message', {
            text: `Error starting inventory session: ${error.message}`,
            type: 'error'
          })

          // Show additional guidance if JSON parsing failed
          if (error.message.includes('JSON')) {
            EventBus.emit('message', {
              text: 'There was a problem with the server response. Please try again or contact support.',
              type: 'error'
            })
          }
        })
    },

    handleToggleExpand(itemId) {
      this.items = this.items.map((item, index) => ({
        ...item,
        isExpanded: `${index}-${item.id}` === itemId ? !item.isExpanded : false // Toggle the clicked item, collapse others
      }))
    },

    exportDataToCSV() {
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

      // Create a map of scanned items using their barcodes
      const scannedItemsMap = new Map(this.items.map((item) => [item.external_id, item]))

      // Add defensive check for location_data
      const locationData = this.sessionData.response_data.location_data || []
      const expectedBarcodesSet = new Set(locationData.map((item) => item.barcode))

      // Combine expected items and scanned items
      let combinedItems = [
        ...locationData,
        ...this.items.filter((item) => !expectedBarcodesSet.has(item.external_id))
      ]

      // Filter for missing items only if requested
      if (this.exportMissingOnly) {
        combinedItems = combinedItems.filter((item) => {
          const barcode = item.barcode || item.external_id
          // Item is missing if it was expected but not scanned
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

          // Determine item status
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
      a.download = this.exportMissingOnly ? 'missing_items.csv' : 'inventory.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Show a message with the count of exported items
      EventBus.emit('message', {
        type: 'success',
        text: `Exported ${combinedItems.length} items to CSV${this.exportMissingOnly ? ' (missing items only)' : ''}`
      })
    },

    checkItemStatuses(item, selectedStatuses) {
      // Initialize invalidStatus as an object
      item.invalidStatus = {}

      const statusKeyValuePairs = {
        'items.itemlost': item.lost_status,
        'items.notforloan': item.not_for_loan_status,
        'items.withdrawn': item.withdrawn,
        'items.damaged': item.damaged_status
      }

      for (const [key, value] of Object.entries(statusKeyValuePairs)) {
        if (value != '0' && !selectedStatuses[key].includes(String(value))) {
          item.invalidStatus['key'] = key // Flag the item as having an invalid status
          item.invalidStatus['value'] = value
          break
        }
      }
    },

    checkItemSpecialStatuses(item) {
      // Check for withdrawn items - handle both string and numeric values
      if (
        (item.withdrawn === '1' || item.withdrawn === 1) &&
        this.alertSettings.showWithdrawnAlerts
      ) {
        EventBus.emit('message', {
          type: 'warning',
          text: `${item.title} (${item.barcode || item.external_id}) has been withdrawn from circulation`
        })
      }

      // Check for holds
      if (item.on_hold && this.alertSettings.showOnHoldAlerts) {
        let holdMsg = `${item.title} (${item.barcode}) has a hold placed on it`

        if (item.waiting) {
          holdMsg += ' and is waiting for pickup'
        } else if (item.in_transit) {
          holdMsg += ' and is in transit to fulfill the hold'
        }

        EventBus.emit('message', {
          type: 'warning',
          text: holdMsg
        })
      }

      // Check for in transit items
      if (item.in_transit && this.alertSettings.showInTransitAlerts) {
        EventBus.emit('message', {
          type: 'warning',
          text: `${item.title} (${item.barcode}) is in transit from ${item.homebranch} to ${item.holdingbranch}`
        })
      }

      // Check for branch mismatch
      if (item.homebranch !== item.holdingbranch && this.alertSettings.showBranchMismatchAlerts) {
        EventBus.emit('message', {
          type: 'info',
          text: `${item.title} (${item.barcode}) belongs to ${item.homebranch} but is currently at ${item.holdingbranch}`
        })
      }

      // Check for return claims
      if (item.return_claim && this.alertSettings.showReturnClaimAlerts) {
        EventBus.emit('message', {
          type: 'warning',
          text: `${item.title} (${item.barcode}) has an unresolved return claim. Patron claims they returned it, but it's still checked out.`
        })
      }
    },

    toggleScannerMode() {
      // First, force the scanner to stop and release camera
      if (this.scannerMode) {
        // If we're currently in scanner mode, make sure it's cleaned up
        try {
          EventBus.emit('stop-scanner')
          // Give time for camera to release before toggling mode
          setTimeout(() => {
            this.scannerMode = false
          }, 200)
        } catch (e) {
          this.scannerMode = false
        }
      } else {
        // If we're not in scanner mode, we can switch immediately
        this.scannerMode = true
      }
    },

    onBarcodeDetected(code) {
      // Trim whitespace from detected code
      const trimmedCode = code.trim()

      // Only process if code is not empty after trimming
      if (trimmedCode) {
        this.barcode = trimmedCode
        this.submitBarcode()

        // Show confirmation to the user
        EventBus.emit('message', {
          type: 'status',
          text: `Barcode detected: ${trimmedCode}`
        })
      }
    },

    checkDeviceType() {
      this.isMobileView = window.innerWidth < 768
    },

    toggleEndSessionModal() {
      // Close the Shelf Preview modal if it's open
      if (this.showShelfPreview) {
        this.showShelfPreview = false
      }
      this.showEndSessionModal = !this.showEndSessionModal
    },

    toggleMissingItemsModal() {
      // Close the Shelf Preview modal if it's open
      if (this.showShelfPreview) {
        this.showShelfPreview = false
      }

      // Toggle the modal visibility state
      this.showMissingItemsModal = !this.showMissingItemsModal

      if (this.showMissingItemsModal) {
        // If opening the modal, update the marked missing items
        this.handleMissingItemsUpdated()
      }
    },

    closeMissingItemsModal() {
      this.showMissingItemsModal = false
    },

    toggleShelfPreview() {
      this.showShelfPreview = !this.showShelfPreview

      if (this.showShelfPreview) {
        // Load authorized values for location codes if not already loaded
        this.loadAuthorizedValueCategories()
      }
    },

    closeShelfPreview() {
      this.showShelfPreview = false
    },

    handleUpcomingItemsLoaded(count) {
      this.upcomingItemsCount = count
    },

    async loadAuthorizedValueCategories() {
      if (Object.keys(this.authorizedValueCategories).length === 0) {
        try {
          // Load location codes
          const locValues = await this.fetchAuthorizedValues('LOC', { forceLoad: true })
          this.authorizedValueCategories = {
            ...this.authorizedValueCategories,
            LOC: locValues
          }
        } catch (error) {
          console.error('Error loading authorized value categories:', error)
        }
      }
    },

    handleItemMarkedMissing(barcode) {
      // Add the barcode to the markedMissingItems set
      this.markedMissingItems.add(barcode)
      // Update session storage to keep track of marked items
      saveMarkedMissingItems(Array.from(this.markedMissingItems))
    },

    handleItemsMarkedMissing(barcodes) {
      // Add all barcodes to the markedMissingItems set
      barcodes.forEach((barcode) => this.markedMissingItems.add(barcode))
      // Update session storage
      saveMarkedMissingItems(Array.from(this.markedMissingItems))
    },

    getMissingItemsCount() {
      if (!this.sessionData || !this.sessionData.response_data) {
        return 0
      }

      // Get the location data from session response
      const locationData = this.sessionData.response_data.location_data || []

      // If location data is empty, try to use right_place_list as a fallback
      let itemsToCheck = locationData
      if (itemsToCheck.length === 0 && this.sessionData.response_data.right_place_list) {
        itemsToCheck = this.sessionData.response_data.right_place_list
      }

      if (itemsToCheck.length === 0) {
        // No data to process
        return 0
      }

      // Get a set of scanned barcodes for quick lookup
      const scannedBarcodesSet = new Set(this.items.map((item) => item.external_id))

      // Use our already initialized markedMissingItems set
      const markedMissingSet = this.markedMissingItems

      // Count items that haven't been scanned, aren't marked as missing, and meet session criteria
      const count = itemsToCheck.filter((item) => {
        // Skip items that have already been scanned
        if (scannedBarcodesSet.has(item.barcode)) {
          return false
        }

        // Skip items that have already been marked as missing
        if (markedMissingSet.has(item.barcode)) {
          return false
        }

        // Skip items that are checked out if the session is configured to do so
        if (this.sessionData.skipCheckedOutItems && (item.checked_out || item.checked_out_date)) {
          return false
        }

        // Skip items that are in transit if the session is configured to do so
        if (this.sessionData.skipInTransitItems && item.in_transit) {
          return false
        }

        // Skip items that have branch mismatch if the session is configured to do so
        if (this.sessionData.skipBranchMismatchItems && item.homebranch !== item.holdingbranch) {
          return false
        }

        return true
      }).length

      return count
    },

    setupStarted(data) {
      this.session_id = data.id
      this.inventoryDate = data.inventoryDate
      this.currentLibrary = data.library
      this.shelvingLocation = data.shelvingLocation
      this.skipCheckedOutItems = data.skipCheckedOutItems
      this.skipInTransitItems = data.skipInTransitItems
      this.skipBranchMismatchItems = data.skipBranchMismatchItems
      this.doNotCheckIn = data.doNotCheckIn
      this.checkShelvedOutOfOrder = data.checkShelvedOutOfOrder
      this.statuses = data.statuses
      this.locations = data.locations
      this.compareBarcodes = data.compareBarcodes
      this.locationCode = data.collectionCode || ''

      // Handle alert settings
      if (data.alertSettings) {
        this.alertSettings = data.alertSettings
      }

      // Handle resolution settings - merge with existing settings instead of overwriting
      if (data.resolutionSettings) {
        // Keep our explicit initialization but update with any provided values
        this.resolutionSettings = {
          ...this.resolutionSettings, // Keep existing settings
          ...data.resolutionSettings // Override with any new settings from data
        }
      }

      // Log the status of alerts and resolutions for debugging

      this.getItems()
    },

    markItemMissing(barcode) {
      // Update the Set with the barcode
      this.markedMissingItems.add(barcode)

      // Convert the Set to an array for storage
      const barcodesArray = Array.from(this.markedMissingItems)

      // Save to storage
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
    },

    processItem(item) {
      // Add more fields from the inventory response if available
      if (this.sessionData && this.sessionData.response_data) {
        // If we are comparing against expected barcodes
        if (this.sessionData.compareBarcodes && this.sessionData.response_data.right_place_list) {
          const rightPlaceList = this.sessionData.response_data.right_place_list

          // Check if the scanned item is in the "right place" list
          const expectedItem = rightPlaceList.find(
            (listItem) => listItem.barcode === item.external_id
          )

          // Set a flag to indicate if this item is on the expected list
          item.isOnExpectedList = !!expectedItem
        }
      }

      // Add the processed item to the top of the list
      this.items.unshift(item)

      // Set all items to be collapsed except the first one
      this.items = this.items.map((item, index) => ({
        ...item,
        isExpanded: index === 0 // Only expand the first item
      }))

      // Save the updated items list to storage
      return saveItems(this.items)
        .then(() => {
          // Update highest call number if needed
          this.updateHighestCallNumber()

          // Clear the barcode input field
          this.barcode = ''
        })
        .catch((error) => {
          console.error('Error processing item:', error)
          EventBus.emit('message', {
            text: 'Error processing item: ' + error.message,
            type: 'error'
          })
        })
    },

    saveResolutionAction(resolution) {
      // Close the modal
      this.showResolutionModal = false

      // Create a new array from the current items
      const updatedItems = [...this.items]

      // Find the index of the item to update
      const itemIndex = updatedItems.findIndex(
        (item) =>
          item.external_id === this.currentResolutionItem.external_id &&
          item.pendingResolution &&
          item.resolutionType === this.currentResolutionType
      )

      if (itemIndex >= 0) {
        // Update the item at the found index
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          pendingResolution: false,
          resolutionStatus: 'resolved',
          resolutionInfo: resolution
        }

        // Update the items list
        this.items = updatedItems

        // Save the updated items to storage
        saveItems(this.items)
          .then(() => {
            // Show a success message
            EventBus.emit('message', {
              text: `Resolution for ${this.currentResolutionItem.external_id} saved`,
              type: 'status'
            })
          })
          .catch((error) => {
            console.error('Error saving resolution action:', error)
            EventBus.emit('message', {
              text: 'Error saving resolution: ' + error.message,
              type: 'error'
            })
          })
      }

      // Reset the current resolution item
      this.currentResolutionItem = null
      this.currentResolutionType = ''
    },

    completeSession() {
      // Save final session data
      saveSession(this.sessionData)
        .then(() => {
          // Save final items list
          return saveItems(this.items)
        })
        .then(() => {
          // Save final marked missing items if needed
          if (this.markedMissingItems.size > 0) {
            return saveMarkedMissingItems(Array.from(this.markedMissingItems))
          }
          return Promise.resolve()
        })
        .then(() => {
          // Clear session data and reset UI
          this.sessionData = null
          this.sessionStarted = false
          this.items = []
          this.markedMissingItems = new Set()
          this.highestCallNumberSort = ''
          this.showEndSessionModal = false

          // Clear session storage
          return clearSession()
        })
        .then(() => {
          // Show success message
          EventBus.emit('message', { text: 'Inventory session ended', type: 'status' })
        })
        .catch((error) => {
          console.error('Error completing session:', error)
          EventBus.emit('message', {
            text: 'Error ending session: ' + error.message,
            type: 'error'
          })
        })
    },

    openResolutionModal(item, type, patronName = '') {
      // Mark item as scanned
      item.wasScanned = true

      // Create a new instance to avoid modifying the original object
      const newItem = { ...item }

      // Add issue information to the item based on type
      switch (type) {
        case 'checkedout':
          // The InventoryItem component already checks for checked_out_date
          // This will be detected automatically
          newItem.pendingResolution = true
          newItem.resolutionType = 'checkedout'
          break

        case 'lost':
          // Set wasLost flag which is already recognized by InventoryItem
          newItem.wasLost = true
          newItem.pendingResolution = true
          newItem.resolutionType = 'lost'
          newItem.originalLostStatus = newItem.lost_status
          break

        case 'intransit':
          // The InventoryItem component already checks for in_transit
          newItem.pendingResolution = true
          newItem.resolutionType = 'intransit'
          break

        case 'returnclaim':
          // The InventoryItem component already checks for return_claim
          newItem.pendingResolution = true
          newItem.resolutionType = 'returnclaim'
          break

        case 'withdrawn':
          // Set properties for withdrawn items
          newItem.pendingResolution = true
          newItem.resolutionType = 'withdrawn'
          break
      }

      // Always add to the top of the list as the latest scan, without removing previous entries
      this.items.unshift(newItem)

      // Set all items to be collapsed except the first one
      this.items = this.items.map((itm, index) => ({
        ...itm,
        isExpanded: index === 0 // Only expand the first item
      }))

      // Save updated items to session storage
      saveItems(this.items).catch((error) => {
        console.error('Error saving items after resolution modal:', error)
      })

      // Now set up and show the resolution modal
      this.currentResolutionItem = newItem
      this.currentResolutionType = type
      this.currentPatronName = patronName
      this.showResolutionModal = true
    },

    closeResolutionModal() {
      this.showResolutionModal = false
      this.currentResolutionItem = null
      this.currentResolutionType = ''
      this.currentPatronName = ''
    },

    handleResolutionComplete(result) {
      const item = result.item
      const action = result.action
      const type = result.type

      // Find the item in our items array (should be the first item)
      const itemIndex = this.items.findIndex(
        (i) =>
          (i.external_id && i.external_id === item.external_id) ||
          (i.barcode && i.barcode === item.barcode)
      )

      if (itemIndex >= 0) {
        // Create the updated item with resolved status
        const updatedItem = { ...this.items[itemIndex] }

        // Update item status based on resolution type and action
        switch (type) {
          case 'checkedout':
            if (action === 'checkin') {
              updatedItem.checked_out_date = null
              updatedItem.due_date = null

              // Update resolution information
              updatedItem.pendingResolution = false
              updatedItem.resolutionAction = 'checked in'

              // Store transit information if present
              if (result.result && result.result.needs_transfer) {
                updatedItem.needs_transfer = true
                updatedItem.transfer_to = result.result.transfer_to
              }
            } else if (action === 'renew') {
              // Update resolution information
              updatedItem.pendingResolution = false
              updatedItem.resolutionAction = 'renewed'
            } else if (action === 'skip') {
              // Update resolution information
              updatedItem.pendingResolution = true
              updatedItem.resolutionAction = 'skipped'
            }
            break

          case 'lost':
            if (action === 'found') {
              // Store the original lost status for reference and display
              updatedItem.originalLostStatus = updatedItem.lost_status
              updatedItem.wasLost = true // Keep track that it was lost

              // Don't clear the lost_status in the UI data
              // This preserves the reason while still showing it as resolved

              // Update resolution information
              updatedItem.pendingResolution = false
              updatedItem.resolutionAction = 'marked found'

              // Update item status in Koha - but don't update our local display data
            } else if (action === 'skip') {
              // Update resolution information
              updatedItem.pendingResolution = true
              updatedItem.resolutionAction = 'skipped'
            }
            break

          case 'withdrawn':
            if (action === 'restore') {
              // Store the original withdrawn status for reference
              updatedItem.originalWithdrawnStatus = updatedItem.withdrawn
              updatedItem.wasWithdrawn = true // Keep track that it was withdrawn

              // Clear the withdrawn status in the UI data
              updatedItem.withdrawn = '0' // Clear withdrawn status for display

              // Update resolution information
              updatedItem.pendingResolution = false
              updatedItem.resolutionAction = 'restored to circulation'

              // Update item status in Koha
              this.updateSingleItemStatus(updatedItem.external_id, { withdrawn: '0' })
            } else if (action === 'skip') {
              // Update resolution information
              updatedItem.pendingResolution = true
              updatedItem.resolutionAction = 'skipped'
            }
            break

          case 'intransit':
            if (action === 'resolve') {
              updatedItem.in_transit = false

              // Update resolution information
              updatedItem.pendingResolution = false
              updatedItem.resolutionAction = 'transit resolved'
            } else if (action === 'skip') {
              // Update resolution information
              updatedItem.pendingResolution = true
              updatedItem.resolutionAction = 'skipped'
            }
            break

          case 'returnclaim':
            if (action === 'resolve') {
              updatedItem.return_claim = false

              // Update resolution information
              updatedItem.pendingResolution = false
              updatedItem.resolutionAction = 'claim resolved'
            } else if (action === 'skip') {
              // Update resolution information
              updatedItem.pendingResolution = true
              updatedItem.resolutionAction = 'skipped'
            }
            break
        }

        // For resolved items, make sure it shows as a success
        if (!updatedItem.pendingResolution) {
          // Clear any status flags that would make it appear as having an issue
          if (type === 'checkedout') {
            updatedItem.checked_out_date = null
          } else if (type === 'lost') {
            // Keep wasLost true for history but clear active flags for display
            // Don't clear lost_status - we want to preserve the reason for display
            // updatedItem.lost_status = '0';
          } else if (type === 'withdrawn') {
            // Keep wasWithdrawn true for history but explicitly clear withdrawn status for display
            updatedItem.withdrawn = '0'
          } else if (type === 'intransit') {
            updatedItem.in_transit = false
          } else if (type === 'returnclaim') {
            updatedItem.return_claim = false
          }
        }

        // Update the item in place (it should already be at the top)
        this.items[itemIndex] = updatedItem

        // Save updated items to session storage
        saveItems(this.items)

        // Emit a success message
        EventBus.emit('message', {
          type: 'success',
          text: `Item ${item.external_id || item.barcode} has been processed successfully`
        })
      }
    },

    async handleMissingItemsUpdated() {
      // Update the local set of marked missing items with defensive handling
      try {
        const markedItems = await getMarkedMissingItems()
        // Make a fresh Set from the array to ensure we don't have duplicates
        this.markedMissingItems = new Set(Array.isArray(markedItems) ? markedItems : [])
      } catch (error) {
        console.error('Error updating marked missing items:', error)
        this.markedMissingItems = new Set()
      }
    }
  }
}
</script>

<style scoped>
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
  padding-bottom: 55px; /* Reduced from 80px to ~2/3 of original value */
  height: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* Smooth scrolling for iOS */
}

.barcode-input-container {
  margin-bottom: 20px;
}

.barcode-form {
  width: 100%;
}

.input-group {
  display: flex;
  width: 100%;
}

.input-group input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px 0 0 4px;
  font-size: 16px;
}

.camera-button {
  background-color: #f8f9fa;
  border: 1px solid #ccc;
  border-left: none;
  padding: 0 15px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s ease;
}

.camera-button.active {
  background-color: #ff5252;
  color: white;
}

.camera-button:hover {
  background-color: #e9ecef;
}

.camera-button.active:hover {
  background-color: #ff3838;
}

.input-group button[type='submit'] {
  padding: 10px 15px;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.input-group button[type='submit']:hover {
  background-color: #0056b3;
}

.result-panel {
  display: flex;
  flex-direction: column;
}

.scanner-panel {
  flex: 1;
  min-width: 0;
  /* Important for flex items with nested content */
}

.latest-scan-panel {
  flex: 1;
  min-width: 0;
  /* Important for flex items with nested content */
}

.scanner-panel {
  margin-bottom: 20px;
}

.result-panel.with-scanner {
  margin-top: 20px;
}

.latest-scan-panel {
  margin-bottom: 20px;
}

.items-list {
  margin-top: 20px;
}

h3 {
  margin: 0 0 15px 0;
  color: #555;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.scanner-help-text {
  text-align: center;
  margin-top: 10px;
  color: #555;
  font-size: 0.9rem;
}

.scanner-with-results {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.no-items-message {
  color: #666;
  font-style: italic;
  padding: 10px 0;
}

/* Add/update these styles */
.manual-mode-results {
  width: 100%;
}

.manual-mode-results .latest-scan-panel {
  width: 100%;
}

/* Media queries for responsive layout */
@media (min-width: 768px) {
  .container {
    max-width: 1200px;
    /* Wider container for desktop */
  }

  .scanner-with-results {
    flex-direction: row;
    align-items: flex-start;
  }

  .scanner-panel {
    width: 48%;
  }

  .latest-scan-panel {
    width: 48%;
  }
}

@media (max-width: 768px) {
  .input-group {
    flex-wrap: wrap;
  }

  .input-group input {
    flex: 1 0 70%;
  }

  .camera-button {
    flex: 0 0 auto;
  }

  .input-group button[type='submit'] {
    flex: 0 0 auto;
  }

  .scanner-with-results {
    flex-direction: column;
  }

  .scanner-panel,
  .latest-scan-panel {
    width: 100%;
  }
}

.end-session-button {
  position: fixed;
  bottom: 20px;
  left: 20px;
  padding: 10px 20px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  z-index: 1000;
  /* Ensure it stays above other content */
  width: 150px; /* Fixed width for all buttons */
  height: 45px; /* Fixed height for all buttons */
  display: flex;
  align-items: center;
  justify-content: center;
}

.end-session-button:hover {
  background-color: #d32f2f;
}

.missing-items-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: #ff9800;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150px; /* Fixed width for all buttons */
  height: 45px; /* Fixed height for all buttons */
  box-sizing: border-box; /* Ensure padding doesn't affect height */
}

.missing-items-button:hover {
  background-color: #f57c00;
}

.missing-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f44336;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  min-width: 24px; /* Prevent badge from changing button width */
  min-height: 24px; /* Prevent badge from changing button height */
  font-size: 14px;
  margin-left: 8px;
}

.end-session-modal-button {
  padding: 10px 20px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  /* Ensure this is higher than the end-session-button z-index */
}

.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 500px;
  max-width: 90%;
  position: relative;
  /* Ensure proper stacking context */
}

.close {
  position: absolute;
  top: 10px;
  right: 15px;
  font-size: 24px;
  cursor: pointer;
}

.shelf-preview-button {
  position: fixed;
  bottom: 20px;
  right: 190px; /* Position to the left of the missing-items-button with spacing */
  padding: 10px 20px;
  background-color: #2196f3; /* Blue color to differentiate */
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150px; /* Fixed width for all buttons */
  height: 45px; /* Fixed height for all buttons */
  box-sizing: border-box; /* Ensure padding doesn't affect height */
}

.shelf-preview-button:hover {
  background-color: #1976d2;
}

.upcoming-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #4caf50; /* Green color for the count badge */
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  min-width: 24px; /* Prevent badge from changing button width */
  min-height: 24px; /* Prevent badge from changing button height */
  font-size: 14px;
  margin-left: 8px;
}

/* Responsive button styling for mobile */
@media (max-width: 767px) {
  /* Create a button container for mobile */
  .end-session-button,
  .missing-items-button,
  .shelf-preview-button {
    position: fixed;
    padding: 8px 5px;
    font-size: 14px;
    bottom: 10px;
    width: 32%; /* More evenly distribute space */
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-width: 0; /* Override previous min-width */
  }

  /* Position buttons using percentages of screen width */
  .end-session-button {
    left: 1%;
  }

  .shelf-preview-button {
    left: 34%; /* Center button */
    right: auto;
    transform: none;
  }

  .missing-items-button {
    right: 1%;
  }

  /* Make sure count badges still fit properly */
  .missing-count,
  .upcoming-count {
    width: 18px;
    height: 18px;
    font-size: 11px;
    margin-left: 4px; /* Smaller margin on mobile */
  }

  /* Increase bottom padding on mobile to ensure content isn't obscured */
  .container {
    padding-bottom: 65px; /* Reduced from 100px to ~2/3 of original value */
  }
}

/* Additional adjustments for very small screens */
@media (max-width: 480px) {
  .end-session-button,
  .missing-items-button,
  .shelf-preview-button {
    font-size: 12px;
    padding: 8px 2px;
  }

  .missing-count,
  .upcoming-count {
    width: 16px;
    height: 16px;
    font-size: 10px;
    margin-left: 2px;
  }
}

/* Loading indicator styles */
.session-initializing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border-top: 4px solid #007bff;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-detail {
  color: #666;
  font-size: 0.9rem;
  margin-top: 5px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Active filters display styles */
.active-filters-container {
  margin-bottom: 15px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  cursor: pointer;
  border-bottom: 1px solid #dee2e6;
  transition: background-color 0.2s;
}

.filters-header:hover {
  background-color: #e9ecef;
}

.filters-header h3 {
  margin: 0;
  color: #495057;
  font-size: 1.1rem;
  font-weight: 600;
}

.filter-summary {
  font-size: 0.9rem;
  font-weight: normal;
  color: #6c757d;
}

.toggle-button {
  background: none;
  border: none;
  font-size: 1rem;
  color: #495057;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s;
}

.toggle-button.expanded {
  transform: rotate(0deg);
}

.active-filters {
  padding: 15px;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.filter-item {
  background-color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  font-size: 0.9rem;
}

.filter-item strong {
  color: #495057;
  margin-right: 8px;
}

.comparison-mode {
  background-color: #e3f2fd;
  border-color: #2196f3;
}

.scan-mode {
  background-color: #e8f5e9;
  border-color: #4caf50;
}

/* Responsive adjustments for active filters */
@media (max-width: 767px) {
  .filters-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .active-filters-container {
    margin-bottom: 10px;
  }

  .filters-header {
    padding: 10px 12px;
  }

  .filters-header h3 {
    font-size: 1rem;
  }

  .filter-summary {
    font-size: 0.8rem;
  }

  .active-filters {
    padding: 12px;
  }

  .filter-item {
    padding: 6px 10px;
    font-size: 0.85rem;
  }
}
</style>
