<template>
  <div class="missing-items-modal-overlay">
    <div class="missing-items-modal">
      <div class="missing-items-modal-header">
        <h2>Inventory Dashboard</h2>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>

      <div class="missing-items-modal-body">
        <div v-if="loading" class="loading-indicator">
          <div class="spinner"></div>
          <p>Processing...</p>
        </div>

        <div v-else>
          <div class="tab-container">
            <div
              class="tab"
              :class="{ active: activeTab === 'processed' }"
              @click="activeTab = 'processed'"
            >
              Processed Items ({{ processedItems.length }})
            </div>
            <div
              class="tab"
              :class="{ active: activeTab === 'expected' }"
              @click="activeTab = 'expected'"
            >
              Items Not Processed ({{ missingItems.length }})
            </div>
          </div>

          <!-- Expected (Missing) Items Tab Content -->
          <div v-if="activeTab === 'expected'">
            <div class="missing-items-stats">
              <div class="stat-box">
                <div class="stat-number">{{ missingItems.length }}</div>
                <div class="stat-label">Items Not Processed</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">{{ totalExpectedItems }}</div>
                <div class="stat-label">Expected Items</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">
                  {{ Math.round((missingItems.length / totalExpectedItems) * 100) || 0 }}%
                </div>
                <div class="stat-label">Not Yet Processed</div>
              </div>
            </div>

            <div class="missing-items-controls">
              <div class="search-filter">
                <input
                  type="text"
                  v-model="searchQuery"
                  placeholder="Search by title, author, barcode..."
                  @input="applyFilters"
                  class="search-input"
                />
              </div>

              <div class="filter-controls">
                <select v-model="sortBy" @change="applyFilters" class="filter-select">
                  <option value="title">Sort by Title</option>
                  <option value="author">Sort by Author</option>
                  <option value="callNumber">Sort by Call Number</option>
                  <option value="barcode">Sort by Barcode</option>
                </select>

                <div class="checkbox-control">
                  <input
                    type="checkbox"
                    id="selectAll"
                    v-model="selectAll"
                    @change="toggleSelectAll"
                  />
                  <label for="selectAll">Select All</label>
                </div>
              </div>

              <div class="action-buttons">
                <button
                  class="export-button"
                  @click="exportSelectedToCSV"
                  :disabled="selectedItems.length === 0"
                >
                  Export Selected
                </button>
                <button
                  class="mark-button"
                  @click="markSelectedAsMissing"
                  :disabled="selectedItems.length === 0"
                >
                  Set Status to Missing
                </button>
              </div>
            </div>

            <div v-if="filteredItems.length === 0" class="no-missing-items">
              <p v-if="searchQuery">No items match your search criteria.</p>
              <p v-else>No items were missing from inventory.</p>
            </div>

            <div v-else class="missing-items-list">
              <table>
                <thead>
                  <tr>
                    <th width="40px"></th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Barcode</th>
                    <th>Call Number</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in filteredItems"
                    :key="item.barcode"
                    :class="{ 'selected-row': selectedItemsSet.has(item.barcode) }"
                  >
                    <td>
                      <input
                        type="checkbox"
                        :id="'item-' + item.barcode"
                        :value="item.barcode"
                        v-model="selectedItems"
                        @change="updateSelectAllState"
                      />
                    </td>
                    <td>{{ item.title || 'N/A' }}</td>
                    <td>{{ item.author || 'N/A' }}</td>
                    <td>{{ item.barcode }}</td>
                    <td>{{ item.itemcallnumber || 'N/A' }}</td>
                    <td>{{ item.location || 'N/A' }}</td>
                    <td>
                      <button class="action-button" @click="markItemAsMissing(item)">
                        Set to Missing
                      </button>
                      <button class="action-button" @click="viewItemDetails(item)">Details</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pagination-controls" v-if="filteredItems.length > 0">
              <button
                @click="currentPage > 1 ? currentPage-- : null"
                :disabled="currentPage === 1"
                class="page-button"
              >
                Previous
              </button>
              <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
              <button
                @click="currentPage < totalPages ? currentPage++ : null"
                :disabled="currentPage === totalPages"
                class="page-button"
              >
                Next
              </button>
            </div>
          </div>

          <!-- Processed Items Tab Content -->
          <div v-if="activeTab === 'processed'">
            <div class="processed-items-stats">
              <div class="stat-box">
                <div class="stat-number">{{ scannedItems.length }}</div>
                <div class="stat-label">Scanned Items</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">{{ markedMissingItems.length }}</div>
                <div class="stat-label">Marked Missing</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">{{ totalProcessedItems }}</div>
                <div class="stat-label">Total Processed</div>
              </div>
            </div>

            <div class="missing-items-controls">
              <div class="search-filter">
                <input
                  type="text"
                  v-model="processedSearchQuery"
                  placeholder="Search by title, author, barcode..."
                  @input="applyProcessedFilters"
                  class="search-input"
                />
              </div>

              <div class="filter-controls">
                <select
                  v-model="processedSortBy"
                  @change="applyProcessedFilters"
                  class="filter-select"
                >
                  <option value="title">Sort by Title</option>
                  <option value="author">Sort by Author</option>
                  <option value="callNumber">Sort by Call Number</option>
                  <option value="barcode">Sort by Barcode</option>
                </select>

                <div class="checkbox-control">
                  <input
                    type="checkbox"
                    id="selectAllProcessed"
                    v-model="selectAllProcessed"
                    @change="toggleSelectAllProcessed"
                  />
                  <label for="selectAllProcessed">Select All</label>
                </div>

                <select
                  v-model="processedFilterType"
                  @change="applyProcessedFilters"
                  class="filter-select"
                >
                  <option value="all">All Items</option>
                  <option value="scanned">Scanned Items</option>
                  <option value="missing">Marked Missing</option>
                </select>
              </div>

              <div class="action-buttons">
                <button
                  class="export-button"
                  @click="exportSelectedProcessedToCSV"
                  :disabled="selectedProcessedItems.length === 0"
                >
                  Export Selected
                </button>
                <button
                  class="mark-button"
                  @click="toggleSelectedStatus"
                  :disabled="selectedProcessedItems.length === 0"
                >
                  Toggle Status
                </button>
              </div>
            </div>

            <div v-if="filteredProcessedItems.length === 0" class="no-missing-items">
              <p v-if="processedSearchQuery">No items match your search criteria.</p>
              <p v-else>No processed items available.</p>
            </div>

            <div v-else class="missing-items-list">
              <table>
                <thead>
                  <tr>
                    <th width="40px"></th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Barcode</th>
                    <th>Call Number</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in filteredProcessedItems"
                    :key="item.barcode"
                    :class="{ 'selected-row': selectedProcessedItemsSet.has(item.barcode) }"
                  >
                    <td>
                      <input
                        type="checkbox"
                        :id="'processed-item-' + item.barcode"
                        :value="item.barcode"
                        v-model="selectedProcessedItems"
                        @change="updateSelectAllProcessedState"
                      />
                    </td>
                    <td>{{ item.title || 'N/A' }}</td>
                    <td>{{ item.author || 'N/A' }}</td>
                    <td>{{ item.barcode }}</td>
                    <td>{{ item.itemcallnumber || 'N/A' }}</td>
                    <td>
                      <span
                        :class="{
                          'status-scanned': item.status === 'scanned',
                          'status-missing': item.status === 'missing'
                        }"
                      >
                        {{ item.status === 'scanned' ? 'Scanned' : 'Missing' }}
                      </span>
                    </td>
                    <td>
                      <button
                        v-if="item.status === 'scanned'"
                        class="action-button warning"
                        @click="markProcessedItemAsMissing(item)"
                      >
                        Set to Missing
                      </button>
                      <button
                        v-else
                        class="action-button success"
                        @click="markProcessedItemAsFound(item)"
                      >
                        Set as Found
                      </button>
                      <button class="action-button" @click="viewItemDetails(item)">Details</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pagination-controls" v-if="filteredProcessedItems.length > 0">
              <button
                @click="processedCurrentPage > 1 ? processedCurrentPage-- : null"
                :disabled="processedCurrentPage === 1"
                class="page-button"
              >
                Previous
              </button>
              <span class="page-info"
                >Page {{ processedCurrentPage }} of {{ processedTotalPages }}</span
              >
              <button
                @click="processedCurrentPage < processedTotalPages ? processedCurrentPage++ : null"
                :disabled="processedCurrentPage === processedTotalPages"
                class="page-button"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Item Detail Modal -->
      <div v-if="showDetailModal" class="detail-modal">
        <div class="detail-modal-content">
          <div class="detail-modal-header">
            <h3>Item Details</h3>
            <button class="close-button" @click="showDetailModal = false">&times;</button>
          </div>
          <div class="detail-modal-body">
            <div v-if="selectedItemDetail">
              <h4>{{ selectedItemDetail.title }}</h4>
              <div class="detail-grid">
                <div class="detail-row">
                  <div class="detail-label">Author:</div>
                  <div class="detail-value">{{ selectedItemDetail.author || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Barcode:</div>
                  <div class="detail-value">{{ selectedItemDetail.barcode }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Call Number:</div>
                  <div class="detail-value">{{ selectedItemDetail.itemcallnumber || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Location:</div>
                  <div class="detail-value">{{ selectedItemDetail.location || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Home Branch:</div>
                  <div class="detail-value">{{ selectedItemDetail.homebranch || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Holding Branch:</div>
                  <div class="detail-value">{{ selectedItemDetail.holdingbranch || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Biblionumber:</div>
                  <div class="detail-value">{{ selectedItemDetail.biblionumber || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Item type:</div>
                  <div class="detail-value">{{ selectedItemDetail.itype || 'N/A' }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Last seen:</div>
                  <div class="detail-value">
                    {{ formatDate(selectedItemDetail.datelastseen) || 'Never' }}
                  </div>
                </div>
              </div>
              <div class="detail-actions">
                <button
                  class="action-button primary"
                  @click="markItemAsMissing(selectedItemDetail)"
                >
                  Set Status to Missing
                </button>
                <a
                  :href="`/cgi-bin/koha/catalogue/detail.pl?biblionumber=${selectedItemDetail.biblionumber}`"
                  target="_blank"
                  class="action-button"
                  >View in Catalog</a
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { EventBus } from './eventBus'
import { apiService } from '../services/apiService'
import { saveMarkedMissingItems, getMarkedMissingItems } from '../services/sessionStorage'
import { filterMissingItems } from '../utils/missingItems'

export default {
  props: {
    sessionData: {
      type: Object,
      required: true
    },
    scannedItems: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      missingItems: [],
      searchQuery: '',
      sortBy: 'title',
      selectedItems: [],
      showDetailModal: false,
      selectedItemDetail: null,
      currentPage: 1,
      itemsPerPage: 20,
      selectAll: false,
      activeTab: 'processed',

      // For processed items tab
      processedItems: [],
      markedMissingItems: [],
      processedSearchQuery: '',
      processedSortBy: 'title',
      selectedProcessedItems: [],
      processedCurrentPage: 1,
      selectAllProcessed: false,
      processedFilterType: 'all'
    }
  },
  computed: {
    totalExpectedItems() {
      return this.sessionData?.response_data?.location_data?.length || 0
    },
    filteredItems() {
      if (!this.missingItems.length) return []

      // Apply search filter if there's a query
      let filtered = this.missingItems
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = this.missingItems.filter((item) => {
          return (
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.author && item.author.toLowerCase().includes(query)) ||
            (item.barcode && item.barcode.toLowerCase().includes(query)) ||
            (item.itemcallnumber && item.itemcallnumber.toLowerCase().includes(query))
          )
        })
      }

      // Apply sorting
      if (this.sortBy) {
        filtered.sort((a, b) => {
          const aVal = a[this.sortBy] || ''
          const bVal = b[this.sortBy] || ''
          return aVal.toString().localeCompare(bVal.toString())
        })
      }

      // Apply pagination
      const start = (this.currentPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return filtered.slice(start, end)
    },
    totalPages() {
      if (!this.missingItems.length) return 1
      return Math.ceil(this.missingItems.length / this.itemsPerPage)
    },
    selectedItemsSet() {
      return new Set(this.selectedItems)
    },

    // New computed properties for processed items
    totalProcessedItems() {
      return this.processedItems.length
    },
    filteredProcessedItems() {
      if (!this.processedItems.length) return []

      // Apply type filter first
      let filtered = this.processedItems
      if (this.processedFilterType !== 'all') {
        filtered = this.processedItems.filter((item) => item.status === this.processedFilterType)
      }

      // Apply search filter if there's a query
      if (this.processedSearchQuery) {
        const query = this.processedSearchQuery.toLowerCase()
        filtered = filtered.filter((item) => {
          return (
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.author && item.author.toLowerCase().includes(query)) ||
            (item.barcode && item.barcode.toLowerCase().includes(query)) ||
            (item.itemcallnumber && item.itemcallnumber.toLowerCase().includes(query))
          )
        })
      }

      // Apply sorting
      if (this.processedSortBy) {
        filtered.sort((a, b) => {
          const aVal = a[this.processedSortBy] || ''
          const bVal = b[this.processedSortBy] || ''
          return aVal.toString().localeCompare(bVal.toString())
        })
      }

      // Apply pagination
      const start = (this.processedCurrentPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return filtered.slice(start, end)
    },
    processedTotalPages() {
      if (!this.processedItems.length) return 1
      return Math.ceil(this.processedItems.length / this.itemsPerPage)
    },
    selectedProcessedItemsSet() {
      return new Set(this.selectedProcessedItems)
    }
  },
  created() {
    this.calculateMissingItems()
    this.loadProcessedItems()
  },
  methods: {
    calculateMissingItems() {
      if (!this.sessionData || !this.sessionData.response_data) {
        this.missingItems = []
        return
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
        this.missingItems = []
        return
      }

      // Get a set of scanned barcodes for quick lookup
      const scannedBarcodesSet = new Set(this.scannedItems.map((item) => item.external_id))

      // Get marked missing items asynchronously
      this.loading = true
      getMarkedMissingItems()
        .then((markedMissingItems) => {
          const markedMissingSet = new Set(markedMissingItems || [])

          // Filter out items that are checked out, in transit, etc. based on session settings
          this.missingItems = filterMissingItems({
            locationData: itemsToCheck,
            rightPlaceList: [],
            scannedBarcodes: scannedBarcodesSet,
            markedMissingBarcodes: markedMissingSet,
            sessionSettings: {
              skipCheckedOutItems: this.sessionData.skipCheckedOutItems,
              skipInTransitItems: this.sessionData.skipInTransitItems,
              skipBranchMismatchItems: this.sessionData.skipBranchMismatchItems
            }
          })

          // Reset pagination when loading new data
          this.currentPage = 1
          this.selectedItems = []
          this.selectAll = false
          this.loading = false
        })
        .catch((error) => {
          console.error('Error getting marked missing items:', error)
          // Continue with empty markedMissingSet
          this.missingItems = filterMissingItems({
            locationData: itemsToCheck,
            rightPlaceList: [],
            scannedBarcodes: scannedBarcodesSet,
            markedMissingBarcodes: [],
            sessionSettings: {
              skipCheckedOutItems: this.sessionData.skipCheckedOutItems,
              skipInTransitItems: this.sessionData.skipInTransitItems,
              skipBranchMismatchItems: this.sessionData.skipBranchMismatchItems
            }
          })

          // Reset pagination when loading new data
          this.currentPage = 1
          this.selectedItems = []
          this.selectAll = false
          this.loading = false
        })
    },

    loadProcessedItems() {
      this.loading = true

      // Initialize array to hold all processed items
      this.processedItems = []

      // Get the location data from session response to use for item lookup
      const locationData = this.sessionData?.response_data?.location_data || []

      // If location data is empty, try to use right_place_list as a fallback
      let lookupData = locationData
      if (lookupData.length === 0 && this.sessionData?.response_data?.right_place_list) {
        lookupData = this.sessionData.response_data.right_place_list
      }

      // Create a map for quick barcode lookup
      const locationDataMap = new Map()
      if (lookupData.length > 0) {
        lookupData.forEach((item) => {
          locationDataMap.set(item.barcode, item)
        })
      }

      // Process scanned items
      if (this.scannedItems && this.scannedItems.length > 0) {
        // Convert scanned items to the format we need
        const scannedProcessed = this.scannedItems.map((item) => {
          // Try to find the item in location data for consistent information
          const barcode = item.external_id || item.barcode
          const locationItem = locationDataMap.get(barcode)

          // If we found the item in location data, use that for consistent information
          if (locationItem) {
            return {
              ...locationItem,
              status: 'scanned'
            }
          } else {
            // Extract data from biblio property if available
            let title = item.title
            let author = item.author

            // If title/author not directly available, try to get from biblio property
            if ((!title || title === 'N/A') && item.biblio && item.biblio.title) {
              title = item.biblio.title
            }

            if ((!author || author === 'N/A') && item.biblio && item.biblio.author) {
              author = item.biblio.author
            }

            // Use the most appropriate fields based on data structure
            return {
              barcode: barcode,
              title: title || 'N/A',
              author: author || 'N/A',
              itemcallnumber: item.call_number || item.callnumber || item.itemcallnumber || 'N/A',
              location: item.location || 'N/A',
              biblionumber:
                item.biblio_id ||
                item.biblionumber ||
                (item.biblio ? item.biblio.biblionumber : null) ||
                'N/A',
              homebranch: item.homebranch || 'N/A',
              holdingbranch: item.holdingbranch || 'N/A',
              itype: item.itype || 'N/A',
              datelastseen: item.datelastseen || item.last_seen_date || 'N/A',
              itemnumber: item.item_id || item.itemnumber || 'N/A',
              status: 'scanned'
            }
          }
        })

        // Add to processed items list
        this.processedItems = [...this.processedItems, ...scannedProcessed]
      }

      // Get marked missing items from session storage asynchronously
      getMarkedMissingItems()
        .then((markedMissingBarcodes) => {
          this.markedMissingItems = markedMissingBarcodes || []

          if (this.markedMissingItems.length > 0) {
            if (lookupData.length > 0) {
              // Find the items that have been marked as missing using the lookup data
              const missingProcessed = this.markedMissingItems
                .map((barcode) => {
                  // Look up the item in our location data map
                  const item = locationDataMap.get(barcode)
                  if (item) {
                    return {
                      ...item,
                      status: 'missing'
                    }
                  }
                  return null
                })
                .filter((item) => item !== null)

              // Add to processed items list
              this.processedItems = [...this.processedItems, ...missingProcessed]
            }
          }

          // Reset pagination and selection for processed items
          this.processedCurrentPage = 1
          this.selectedProcessedItems = []
          this.selectAllProcessed = false
          this.loading = false
        })
        .catch((error) => {
          console.error('Error loading marked missing items:', error)
          // Reset pagination and selection for processed items
          this.processedCurrentPage = 1
          this.selectedProcessedItems = []
          this.selectAllProcessed = false
          this.loading = false
        })
    },

    getSortField() {
      switch (this.sortBy) {
        case 'author':
          return 'author'
        case 'callNumber':
          return 'itemcallnumber'
        case 'barcode':
          return 'barcode'
        case 'title':
        default:
          return 'title'
      }
    },

    applyFilters() {
      // Reset pagination when filters change
      this.currentPage = 1
      // Reset selection
      this.selectedItems = []
      this.selectAll = false
    },

    closeModal() {
      this.$emit('close')
    },

    toggleSelectAll() {
      if (this.selectAll) {
        this.selectedItems = this.filteredItems.map((item) => item.barcode)
      } else {
        this.selectedItems = []
      }
    },

    updateSelectAllState() {
      // If all items are selected, set selectAll to true
      if (
        this.filteredItems.length > 0 &&
        this.selectedItems.length === this.filteredItems.length
      ) {
        this.selectAll = true
      } else {
        this.selectAll = false
      }
    },

    async markItemAsMissing(item) {
      // Prevent executing this function if already in loading state
      if (this.loading) return

      // Don't mark checked out items as missing
      if (item.checked_out || item.checked_out_date) {
        EventBus.emit('message', {
          type: 'warning',
          text: `Item "${item.title || item.barcode}" is checked out and cannot be marked as missing.`
        })
        return
      }

      try {
        // Set loading state
        this.loading = true

        // Call API to mark item as missing
        const result = await apiService.post(`/api/v1/contrib/interactiveinventory/item/field`, {
          barcode: item.barcode,
          fields: { itemlost: 4 } // 4 is the code for "Missing"
        })

        if (result && result.success) {
          // Get current marked missing items for session storage
          const currentMarkedMissing = await getMarkedMissingItems()
          const updatedMarkedMissing = [...new Set([...currentMarkedMissing, item.barcode])]
          await saveMarkedMissingItems(updatedMarkedMissing)

          // Use the same item data but set status to missing
          const itemWithStatus = {
            ...item,
            status: 'missing'
          }

          // Check if the item is already in the processed items list
          const existingIndex = this.processedItems.findIndex((i) => i.barcode === item.barcode)
          if (existingIndex !== -1) {
            // Update existing item
            this.processedItems.splice(existingIndex, 1, itemWithStatus)
          } else {
            // Add as new item
            this.processedItems.push(itemWithStatus)
          }

          // Show success message
          EventBus.emit('message', {
            type: 'success',
            text: `Item "${item.title || item.barcode}" has been set to Missing status.`
          })

          // Remove item from the list if it was successfully marked
          this.missingItems = this.missingItems.filter((i) => i.barcode !== item.barcode)
          this.selectedItems = this.selectedItems.filter((barcode) => barcode !== item.barcode)

          // Notify the parent component
          this.$emit('missing-items-updated')
        } else {
          // Show error message
          EventBus.emit('message', {
            type: 'error',
            text: `Failed to mark item "${item.title || item.barcode}" as missing. Please try again.`
          })
        }
      } catch (error) {
        console.error('Error marking item as missing:', error)
        EventBus.emit('message', {
          type: 'error',
          text: `Error marking item as missing: ${error.message || 'Unknown error'}`
        })
      } finally {
        this.loading = false
      }
    },

    markSelectedAsMissing() {
      this.markAsMissing()
    },

    viewItemDetails(item) {
      this.selectedItemDetail = item
      this.showDetailModal = true
    },

    exportSelectedToCSV() {
      if (this.selectedItems.length === 0) {
        EventBus.emit('showSnackbar', {
          message: 'No items selected to export.',
          type: 'info'
        })
        return
      }

      // Get items that match the selected barcodes
      const itemsToExport = this.missingItems.filter((item) =>
        this.selectedItems.includes(item.barcode)
      )

      // Define the CSV headers
      const headers = [
        'Barcode',
        'Title',
        'Author',
        'Call Number',
        'Location',
        'Home Branch',
        'Holding Branch',
        'Status'
      ]

      // Create CSV content
      let csvContent = headers.join(',') + '\n'

      itemsToExport.forEach((item) => {
        // Escape values to handle commas and quotes in the data
        const row = [
          item.barcode,
          this.escapeCsvValue(item.title || ''),
          this.escapeCsvValue(item.author || ''),
          this.escapeCsvValue(item.itemcallnumber || ''),
          this.escapeCsvValue(item.location || ''),
          this.escapeCsvValue(item.homebranch || ''),
          this.escapeCsvValue(item.holdingbranch || ''),
          'Missing'
        ]

        csvContent += row.join(',') + '\n'
      })

      // Create blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      link.setAttribute('href', url)
      link.setAttribute('download', `missing-items-${timestamp}.csv`)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      EventBus.emit('showSnackbar', {
        message: `Exported ${itemsToExport.length} items to CSV.`,
        type: 'success'
      })
    },

    escapeCsvValue(value) {
      // If the value contains commas or quotes, enclose it in quotes and escape any existing quotes
      if (typeof value !== 'string') return `"${value}"`

      if (value.includes(',') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    },

    formatDate(dateString) {
      if (!dateString) return ''

      try {
        const date = new Date(dateString)
        return date.toLocaleDateString()
      } catch (e) {
        return dateString
      }
    },

    async markAsMissing() {
      if (this.selectedItems.length === 0) {
        EventBus.emit('message', {
          text: 'No items selected to mark as missing.',
          type: 'info'
        })
        return
      }

      // Set loading state
      this.loading = true

      // Filter out items that shouldn't be processed (checked out items)
      const itemsToProcess = this.selectedItems.filter((barcode) => {
        const item = this.missingItems.find((i) => i.barcode === barcode)
        if (!item) return false

        // Don't mark checked out items as missing
        if (item.checked_out || item.checked_out_date) {
          console.log(`Skipping checked out item: ${item.barcode}`)
          EventBus.emit('message', {
            text: `Item ${item.barcode} is checked out and won't be marked as missing.`,
            type: 'warning'
          })
          return false
        }

        return true
      })

      if (itemsToProcess.length === 0) {
        this.loading = false
        EventBus.emit('message', {
          text: 'No items to process after filtering out checked out items.',
          type: 'info'
        })
        return
      }

      // Process each selected item
      const promises = itemsToProcess.map((barcode) => {
        // Find the item object for this barcode
        const item = this.missingItems.find((i) => i.barcode === barcode)
        if (!item) return Promise.resolve() // Skip if item not found

        // Call API to mark item as missing in the system
        return apiService.post(`/api/v1/contrib/interactiveinventory/item/field`, {
          barcode: barcode,
          fields: { itemlost: 4 } // 4 is the code for "Missing"
        })
      })

      // Wait for all API calls to complete
      try {
        await Promise.all(promises)

        // Get current marked missing items for session storage
        const currentMarkedMissing = await getMarkedMissingItems()
        const updatedMarkedMissing = [...new Set([...currentMarkedMissing, ...itemsToProcess])]

        // Save the updated list
        await saveMarkedMissingItems(updatedMarkedMissing)

        // Add processed items to the processed items list
        const newProcessedItems = itemsToProcess
          .map((barcode) => {
            const item = this.missingItems.find((i) => i.barcode === barcode)
            if (!item) return null

            return {
              ...item,
              status: 'missing'
            }
          })
          .filter((item) => item !== null)

        // Update processed items list
        this.processedItems = [...this.processedItems, ...newProcessedItems]

        // Remove items from the missing items list
        this.missingItems = this.missingItems.filter(
          (item) => !itemsToProcess.includes(item.barcode)
        )

        // Clear selection
        this.selectedItems = []
        this.selectAll = false

        // Show success message
        EventBus.emit('message', {
          text: `${itemsToProcess.length} items marked as missing successfully.`,
          type: 'success'
        })

        // Notify the parent component about the update
        this.$emit('missing-items-updated')
      } catch (error) {
        console.error('Error marking items as missing:', error)
        EventBus.emit('message', {
          text: `Error marking items as missing: ${error.message || 'Unknown error'}`,
          type: 'error'
        })
      } finally {
        this.loading = false
      }
    },

    closeModal() {
      this.$emit('close')
    },

    refreshMissingItems() {
      this.calculateMissingItems()
      this.$emit('missing-items-updated')
    },

    applyProcessedFilters() {
      // Reset pagination when filters change
      this.processedCurrentPage = 1
      // Reset selection
      this.selectedProcessedItems = []
      this.selectAllProcessed = false
    },

    toggleSelectAllProcessed() {
      if (this.selectAllProcessed) {
        this.selectedProcessedItems = this.filteredProcessedItems.map((item) => item.barcode)
      } else {
        this.selectedProcessedItems = []
      }
    },

    updateSelectAllProcessedState() {
      // If all items are selected, set selectAllProcessed to true
      if (
        this.filteredProcessedItems.length > 0 &&
        this.selectedProcessedItems.length === this.filteredProcessedItems.length
      ) {
        this.selectAllProcessed = true
      } else {
        this.selectAllProcessed = false
      }
    },

    exportSelectedProcessedToCSV() {
      if (this.selectedProcessedItems.length === 0) {
        EventBus.emit('showSnackbar', {
          message: 'No items selected to export.',
          type: 'info'
        })
        return
      }

      // Get items that match the selected barcodes
      const itemsToExport = this.processedItems.filter((item) =>
        this.selectedProcessedItems.includes(item.barcode)
      )

      // Define the CSV headers
      const headers = [
        'Barcode',
        'Title',
        'Author',
        'Call Number',
        'Location',
        'Home Branch',
        'Holding Branch',
        'Status'
      ]

      // Create CSV content
      let csvContent = headers.join(',') + '\n'

      itemsToExport.forEach((item) => {
        // Escape values to handle commas and quotes in the data
        const row = [
          item.barcode,
          this.escapeCsvValue(item.title || ''),
          this.escapeCsvValue(item.author || ''),
          this.escapeCsvValue(item.itemcallnumber || ''),
          this.escapeCsvValue(item.location || ''),
          this.escapeCsvValue(item.homebranch || ''),
          this.escapeCsvValue(item.holdingbranch || ''),
          item.status === 'scanned' ? 'Found' : 'Missing'
        ]

        csvContent += row.join(',') + '\n'
      })

      // Create blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      link.setAttribute('href', url)
      link.setAttribute('download', `processed-items-${timestamp}.csv`)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      EventBus.emit('showSnackbar', {
        message: `Exported ${itemsToExport.length} items to CSV.`,
        type: 'success'
      })
    },

    async markProcessedItemAsMissing(item) {
      // Don't process if already marked as missing
      if (item.status === 'missing') return

      // Don't mark checked out items as missing
      if (item.checked_out || item.checked_out_date) {
        EventBus.emit('message', {
          type: 'warning',
          text: `Item "${item.title || item.barcode}" is checked out and cannot be marked as missing.`
        })
        return
      }

      try {
        this.loading = true

        // Call API to mark item as missing
        const result = await apiService.post(`/api/v1/contrib/interactiveinventory/item/field`, {
          barcode: item.barcode,
          fields: { itemlost: 4 } // 4 is the code for "Missing"
        })

        if (result && result.success) {
          // Get current marked missing items for session storage
          const currentMarkedMissing = await getMarkedMissingItems()
          const updatedMarkedMissing = [...new Set([...currentMarkedMissing, item.barcode])]
          await saveMarkedMissingItems(updatedMarkedMissing)

          // Update the status in our local data
          const itemIndex = this.processedItems.findIndex((i) => i.barcode === item.barcode)
          if (itemIndex !== -1) {
            this.processedItems[itemIndex].status = 'missing'
          }

          // Show success message
          EventBus.emit('message', {
            type: 'success',
            text: `Item "${item.title || item.barcode}" has been set to Missing status.`
          })

          // Emit event to update parent component
          this.$emit('item-marked-missing', item.barcode)
          this.$emit('missing-items-updated')
        } else {
          throw new Error(result.error || 'Unknown error occurred')
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to set item to Missing status: ${error.message}`
        })
      } finally {
        this.loading = false
      }
    },

    async markProcessedItemAsFound(item) {
      // Don't process if already marked as found (scanned)
      if (item.status === 'scanned') return

      try {
        this.loading = true

        // Call API to mark item as found (remove lost status)
        const result = await apiService.post(`/api/v1/contrib/interactiveinventory/item/field`, {
          barcode: item.barcode,
          fields: { itemlost: 0 } // 0 is the code for not lost
        })

        if (result && result.success) {
          // Remove from marked missing items in session storage
          const currentMarkedMissing = await getMarkedMissingItems()
          const updatedMarkedMissing = currentMarkedMissing.filter(
            (barcode) => barcode !== item.barcode
          )
          await saveMarkedMissingItems(updatedMarkedMissing)

          // Update the status in our local data
          const itemIndex = this.processedItems.findIndex((i) => i.barcode === item.barcode)
          if (itemIndex !== -1) {
            this.processedItems[itemIndex].status = 'scanned'
          }

          // Show success message
          EventBus.emit('message', {
            type: 'success',
            text: `Item "${item.title || item.barcode}" has been marked as Found.`
          })
        } else {
          throw new Error(result.error || 'Unknown error occurred')
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to mark item as Found: ${error.message}`
        })
      } finally {
        this.loading = false
      }
    },

    toggleSelectedStatus() {
      if (this.selectedProcessedItems.length === 0) {
        EventBus.emit('showSnackbar', {
          message: 'No items selected to update.',
          type: 'info'
        })
        return
      }

      // Set loading state
      this.loading = true

      const promises = []
      let markingAsMissing = false // Flag to track if any items are being marked as missing

      // For each selected item, toggle its status (missing <-> found)
      this.selectedProcessedItems.forEach((barcode) => {
        const item = this.processedItems.find((i) => i.barcode === barcode)
        if (!item) return

        if (item.status === 'missing') {
          // If currently missing, mark as found
          promises.push(this.markProcessedItemAsFound(item))
        } else {
          // If currently found/scanned, mark as missing
          // Skip checked out items
          if (item.checked_out || item.checked_out_date) {
            EventBus.emit('message', {
              type: 'warning',
              text: `Item "${item.title || item.barcode}" is checked out and cannot be marked as missing.`
            })
          } else {
            markingAsMissing = true
            promises.push(this.markProcessedItemAsMissing(item))
          }
        }
      })

      // Wait for all operations to complete
      Promise.all(promises)
        .then(() => {
          // Refresh data - but only recalculate missing items if we're marking something as missing
          this.loadProcessedItems()
          if (markingAsMissing) {
            this.calculateMissingItems()
            this.$emit('missing-items-updated')
          }

          // Clear selection
          this.selectedProcessedItems = []
          this.selectAllProcessed = false

          // Show success message
          EventBus.emit('showSnackbar', {
            message: `Updated status for ${promises.length} items.`,
            type: 'success'
          })
        })
        .catch((error) => {
          EventBus.emit('showSnackbar', {
            message: `Error updating items: ${error.message}`,
            type: 'error'
          })
        })
        .finally(() => {
          this.loading = false
        })
    }
  }
}
</script>

<style scoped>
.missing-items-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.missing-items-modal {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.missing-items-modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.missing-items-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
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

.missing-items-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* Tab styles */
.tab-container {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.tab {
  padding: 10px 20px;
  cursor: pointer;
  font-weight: 500;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}

.tab:hover {
  background-color: #f9f9f9;
}

.tab.active {
  color: #3498db;
  border-bottom: 3px solid #3498db;
}

/* Status indicators */
.status-scanned {
  color: #27ae60;
  font-weight: 500;
}

.status-missing {
  color: #e74c3c;
  font-weight: 500;
}

.action-button.warning {
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
}

.action-button.warning:hover {
  background-color: #c0392b;
}

.action-button.success {
  background-color: #27ae60;
  color: white;
  border-color: #27ae60;
}

.action-button.success:hover {
  background-color: #219955;
}

.missing-items-stats,
.processed-items-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 15px;
}

.stat-box {
  flex: 1;
  background-color: #f9f9f9;
  border-radius: 6px;
  padding: 15px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.stat-number {
  font-size: 1.8rem;
  font-weight: bold;
  margin-bottom: 5px;
  color: #2c3e50;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.missing-items-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eaeaea;
}

.search-filter {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
}

.checkbox-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.export-button,
.mark-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-weight: medium;
  cursor: pointer;
  font-size: 14px;
}

.export-button {
  background-color: #3498db;
  color: white;
}

.export-button:hover {
  background-color: #2980b9;
}

.export-button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.mark-button {
  background-color: #e74c3c;
  color: white;
}

.mark-button:hover {
  background-color: #c0392b;
}

.mark-button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.missing-items-list {
  margin-bottom: 20px;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

thead th {
  text-align: left;
  padding: 12px 15px;
  background-color: #f5f5f5;
  border-bottom: 2px solid #e0e0e0;
  font-weight: 600;
}

tbody tr {
  border-bottom: 1px solid #e0e0e0;
}

tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

tbody tr:hover {
  background-color: #f1f1f1;
}

tbody tr.selected-row {
  background-color: #e8f4fd;
}

tbody td {
  padding: 10px 15px;
}

.action-button {
  padding: 5px 10px;
  margin-right: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f5f5f5;
  color: #333;
  cursor: pointer;
  font-size: 13px;
}

.action-button:hover {
  background-color: #e9e9e9;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.page-button {
  padding: 8px 15px;
  border: 1px solid #ddd;
  background-color: white;
  border-radius: 4px;
  cursor: pointer;
}

.page-button:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #666;
}

.no-missing-items {
  text-align: center;
  padding: 40px 0;
  color: #666;
  font-style: italic;
}

.loading-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 10;
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

/* Detail modal styles */
.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.detail-modal-content {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.detail-modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.detail-modal-body {
  padding: 20px;
}

.detail-modal-body h4 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.3rem;
  color: #2c3e50;
}

.detail-grid {
  display: grid;
  grid-gap: 10px;
}

.detail-row {
  display: grid;
  grid-template-columns: 150px 1fr;
  grid-gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-label {
  font-weight: bold;
  color: #555;
}

.detail-actions {
  margin-top: 25px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.action-button.primary {
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
}

.action-button.primary:hover {
  background-color: #c0392b;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .missing-items-stats,
  .processed-items-stats {
    flex-direction: column;
    gap: 10px;
  }

  .missing-items-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .action-buttons {
    flex-direction: column;
  }

  .detail-row {
    grid-template-columns: 1fr;
  }
}
</style>
