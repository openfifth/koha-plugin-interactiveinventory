<template>
  <div class="shelf-preview-container" v-if="show" :key="renderKey">
    <div class="shelf-preview-header">
      <h3>Shelf Browser</h3>
      <button class="close-button" @click="$emit('close')">&times;</button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading shelf...</p>
    </div>

    <div v-else-if="upcomingItems.length === 0" class="empty-state">
      <p v-if="lastScannedItem">No items found on the same shelf as the current item.</p>
      <p v-else>Scan an item to browse the shelf.</p>
      <p v-if="fetchError" class="error-message">{{ fetchError }}</p>
    </div>

    <div v-else class="shelf-content">
      <div class="current-location-info">
        <div class="info-box">
          <div class="info-label">Current Call Number</div>
          <div class="info-value">{{ getCurrentCallNumber() }}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Shelving Location</div>
          <div class="info-value">{{ getCurrentLocation() }}</div>
        </div>
      </div>

      <div class="items-grid">
        <div
          v-for="item in visibleItems"
          :key="item.biblionumber + '-' + item.itemnumber"
          class="item-card"
          :class="{
            'current-item': isCurrentItem(item),
            'next-expected': isNextItem(item)
          }"
        >
          <div class="item-card-header">
            <span class="call-number">{{ item.itemcallnumber || 'No call number' }}</span>
            <span v-if="isCurrentItem(item)" class="current-label">SCANNED</span>
            <span v-else-if="isNextItem(item)" class="next-label">NEXT</span>
          </div>
          <div class="item-card-body">
            <h4 class="item-title">{{ item.title }}</h4>
            <p class="item-author">{{ item.author }}</p>
            <p class="item-barcode">{{ item.barcode }}</p>
            <div v-if="item.issues" class="item-issues">
              <div v-if="item.checked_out" class="issue-tag checked-out">Checked Out</div>
              <div v-if="item.missing" class="issue-tag missing">Missing</div>
              <div v-if="item.in_transit" class="issue-tag in-transit">In Transit</div>
              <div v-if="item.on_hold" class="issue-tag on-hold">On Hold</div>
            </div>
          </div>
          <div class="item-card-footer">
            <div class="location-info">{{ getAuthorizedValueDesc(item.location) }}</div>
          </div>
        </div>
      </div>

      <div class="pagination-controls">
        <button @click="goBack" :disabled="!canGoBack" class="nav-button">← Back</button>
        <button @click="centerOnScanned" class="nav-button center-btn" title="Go to scanned item">
          ● Scanned Item
        </button>
        <button @click="goForward" :disabled="!canGoForward" class="nav-button">Forward →</button>
      </div>
    </div>
  </div>
</template>

<script>
import { EventBus } from './eventBus'
import { apiService } from '../services/apiService'

export default {
  props: {
    show: {
      type: Boolean,
      default: false
    },
    sessionData: {
      type: Object,
      default: null
    },
    lastScannedItem: {
      type: Object,
      default: null
    },
    authorizedValueCategories: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      loading: false,
      upcomingItems: [],
      currentIndex: 0, // Index of first visible item
      itemsPerPage: 5,
      fetchError: null,
      renderKey: 0,
      // Shelf browser response data
      startingLocation: null,
      startingHomebranch: null,
      startingCcode: null,
      prevItem: null,
      nextItem: null,
      windowWidth: window.innerWidth
    }
  },
  computed: {
    responsiveItemsPerPage() {
      if (this.windowWidth < 480) return 2
      if (this.windowWidth < 768) return 3
      if (this.windowWidth < 1024) return 4
      return 5
    },
    visibleItems() {
      return this.upcomingItems.slice(
        this.currentIndex,
        this.currentIndex + this.responsiveItemsPerPage
      )
    },
    canGoBack() {
      return this.currentIndex > 0
    },
    canGoForward() {
      return this.currentIndex + this.responsiveItemsPerPage < this.upcomingItems.length
    },
    scannedItemIndex() {
      if (!this.lastScannedItem) return -1
      return this.upcomingItems.findIndex((i) => i.itemnumber === this.lastScannedItem.item_id)
    }
  },
  watch: {
    show(newVal) {
      if (newVal && this.lastScannedItem) {
        this.initializeData()
      }
    },
    lastScannedItem: {
      handler(newVal) {
        if (newVal && this.show) {
          // Reset and fetch new items
          this.upcomingItems = []
          this.currentIndex = 0
          this.initializeData()
        }
      },
      deep: true
    }
  },
  methods: {
    getCurrentCallNumber() {
      if (!this.lastScannedItem) return 'N/A'

      // Use callnumber directly, which matches the sample item structure
      const callNumber = this.lastScannedItem.callnumber || ''

      // Also check for call_number_sort which is in the sample data
      const cnSort = this.lastScannedItem.call_number_sort || ''

      return callNumber || cnSort || 'N/A'
    },

    getCurrentLocation() {
      if (!this.lastScannedItem) return 'N/A'

      // Use starting_location from API response if available
      if (this.startingLocation && this.startingLocation.description) {
        return this.startingLocation.description
      }

      const location = this.lastScannedItem.location || ''
      return this.getAuthorizedValueDesc(location)
    },

    async fetchUpcomingItems() {
      // If we don't have a lastScannedItem with itemnumber, show empty state
      if (!this.lastScannedItem || !this.lastScannedItem.item_id) {
        this.upcomingItems = []
        return
      }

      this.loading = true
      this.fetchError = null

      try {
        // Use shelf browser API with inventory session filters
        const params = { num_each_side: 10 }
        if (this.sessionData?.selectedLibraryId) {
          params.homebranch = this.sessionData.selectedLibraryId
        }
        if (this.sessionData?.shelvingLocation) {
          params.location = this.sessionData.shelvingLocation
        }
        if (this.sessionData?.ccode) {
          params.ccode = this.sessionData.ccode
        }

        const response = await apiService.get(
          `/api/v1/contrib/interactiveinventory/item/shelfbrowser/${this.lastScannedItem.item_id}`,
          params
        )

        // Store location info for display
        this.startingLocation = response.starting_location
        this.startingHomebranch = response.starting_homebranch
        this.startingCcode = response.starting_ccode

        // Map the response items to our display format
        this.upcomingItems = (response.items || []).map((item) => ({
          itemnumber: item.itemnumber,
          biblionumber: item.biblionumber,
          itemcallnumber: item.itemcallnumber,
          cn_sort: item.cn_sort,
          location: item.location,
          title: item.title || 'Unknown Title',
          subtitle: item.subtitle,
          author: '', // Not provided by shelf browser API
          barcode: '', // Not provided by shelf browser API
          // Issue flags - would need additional API call to get these
          checked_out: false,
          missing: false,
          in_transit: false,
          on_hold: false
        }))

        // Store prev/next for pagination
        this.prevItem = response.prev_item
        this.nextItem = response.next_item
      } catch (error) {
        console.error('Error fetching shelf browser data:', error)
        this.fetchError = error.message
        this.upcomingItems = []
      } finally {
        this.loading = false
      }
    },

    goForward() {
      if (this.canGoForward) {
        this.currentIndex += this.responsiveItemsPerPage
      }
    },

    goBack() {
      if (this.canGoBack) {
        this.currentIndex = Math.max(0, this.currentIndex - this.responsiveItemsPerPage)
      }
    },

    centerOnScanned() {
      if (this.scannedItemIndex === -1) return
      // Center the scanned item in the view
      const halfPage = Math.floor(this.responsiveItemsPerPage / 2)
      this.currentIndex = Math.max(0, this.scannedItemIndex - halfPage)
      // Don't go past the end
      const maxIndex = Math.max(0, this.upcomingItems.length - this.responsiveItemsPerPage)
      this.currentIndex = Math.min(this.currentIndex, maxIndex)
    },

    handleResize() {
      this.windowWidth = window.innerWidth
    },

    getAuthorizedValueDesc(code) {
      if (!code) return 'N/A'

      // Look for the code in the LOC authorized value category from props
      if (
        this.authorizedValueCategories &&
        this.authorizedValueCategories.LOC &&
        this.authorizedValueCategories.LOC[code]
      ) {
        return this.authorizedValueCategories.LOC[code]
      }

      // If not found in props, try localStorage as fallback
      try {
        const authorizedValuesLOC = JSON.parse(localStorage.getItem('authorizedValues_LOC') || '{}')
        if (authorizedValuesLOC[code]) {
          return authorizedValuesLOC[code]
        }
      } catch (e) {
        console.error('Error accessing localStorage for authorized value:', e)
      }

      // If not found in props or localStorage, fetch from API
      apiService
        .fetchAuthorizedValues('LOC')
        .then(() => {
          // After fetching, try to get the value from localStorage again
          try {
            const authorizedValuesLOC = JSON.parse(
              localStorage.getItem('authorizedValues_LOC') || '{}'
            )
            if (authorizedValuesLOC[code]) {
              // This won't update the current rendering, but will be available on next render
              this.renderKey++ // Force component to re-render
            }
          } catch (e) {
            console.error('Error accessing localStorage after fetch:', e)
          }
        })
        .catch((error) => {
          console.error('Error fetching authorized values:', error)
        })

      // Return the code itself as fallback
      return code
    },

    // Fetch authorized values for a category and store in localStorage
    fetchAuthorizedValues(category) {
      return apiService.fetchAuthorizedValues(category)
    },

    // Initialize data and fetch nearby items from API
    async initializeData() {
      if (!this.lastScannedItem) {
        this.upcomingItems = []
        return
      }

      // Reset to start
      this.currentIndex = 0

      // Fetch nearby items and then center on scanned item
      await this.fetchUpcomingItems()

      // Center view on the scanned item
      this.$nextTick(() => {
        this.centerOnScanned()
      })
    },

    // Check if this item is the currently scanned item
    isCurrentItem(item) {
      return this.lastScannedItem && item.itemnumber === this.lastScannedItem.item_id
    },

    // Check if this item is the next one after the scanned item
    isNextItem(item) {
      if (!this.lastScannedItem) return false
      const currentIndex = this.upcomingItems.findIndex(
        (i) => i.itemnumber === this.lastScannedItem.item_id
      )
      if (currentIndex === -1 || currentIndex >= this.upcomingItems.length - 1) return false
      return item.itemnumber === this.upcomingItems[currentIndex + 1].itemnumber
    }
  },

  created() {
    // Initialize on creation
  },

  mounted() {
    // Add resize listener for responsive items per page
    window.addEventListener('resize', this.handleResize)

    // Initialize on mount if the component is shown and we have a lastScannedItem
    if (this.show && this.lastScannedItem) {
      this.initializeData()
    }
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
  }
}
</script>

<style scoped>
.shelf-preview-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 1100px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow: hidden;
  margin-bottom: 60px;
}

.shelf-preview-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shelf-preview-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  color: #666;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  text-align: center;
  color: #666;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 2s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.shelf-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.current-location-info {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.info-box {
  flex: 1;
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
}

.info-label {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 5px;
}

.info-value {
  font-size: 1.1rem;
  font-weight: 500;
  color: #333;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.item-card {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.item-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
}

.item-card.current-item {
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
  background: #e3f2fd;
}

.item-card.next-expected {
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
}

.item-card-header {
  background: #f1f1f1;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
}

.call-number {
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
}

.current-label {
  background: #2196f3;
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}

.next-label {
  background: #4caf50;
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}

.item-card-body {
  padding: 15px;
}

.item-title {
  margin: 0 0 8px 0;
  font-size: 1rem;
  line-height: 1.3;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-author {
  margin: 0 0 5px 0;
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
}

.item-barcode {
  margin: 5px 0;
  font-size: 0.85rem;
  color: #888;
  font-family: monospace;
}

.item-issues {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.issue-tag {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  color: white;
}

.issue-tag.checked-out {
  background: #f44336;
}

.issue-tag.missing {
  background: #ff9800;
}

.issue-tag.in-transit {
  background: #2196f3;
}

.issue-tag.on-hold {
  background: #9c27b0;
}

.item-card-footer {
  padding: 10px 15px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  font-size: 0.8rem;
  color: #666;
}

.location-info {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 10px;
}

.nav-button {
  padding: 8px 15px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.nav-button:hover:not(:disabled) {
  background: #e0e0e0;
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-button.center-btn {
  background: #e3f2fd;
  border-color: #2196f3;
  color: #1976d2;
}

.nav-button.center-btn:hover {
  background: #bbdefb;
}

@media (max-width: 1024px) {
  .items-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .shelf-preview-container {
    width: 95%;
    max-height: 70vh;
  }

  .items-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .current-location-info {
    flex-direction: column;
    gap: 10px;
  }

  .pagination-controls {
    flex-wrap: wrap;
    gap: 10px;
  }

  .nav-button {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .items-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .nav-button.center-btn {
    order: -1;
    width: 100%;
  }
}
</style>
