<template>
  <h1>Interactive Inventory</h1>
  <form @submit.prevent="startInventorySession">
    <div class="section-container">
      <h2>Parameters</h2>
      <div>
        <label for="inventoryDate">Set inventory date to:</label>
        <input type="date" id="inventoryDate" v-model="inventoryDate" />
      </div>
      <label class="checkbox-option">
        <input type="checkbox" id="compareBarcodes" v-model="compareBarcodes" />
        <span class="label-text">Compare expected barcodes list to scanned barcodes</span>
        <span class="help-text" v-if="compareBarcodes"
          >(Scanned barcodes will be checked against the expected items list)</span
        >
        <span class="help-text" v-else
          >(All scanned barcodes will be accepted without comparison)</span
        >
      </label>
      <label class="checkbox-option">
        <input type="checkbox" id="doNotCheckIn" v-model="doNotCheckIn" />
        <span class="label-text">Do not check in items scanned during inventory</span>
      </label>
      <label class="checkbox-option">
        <input type="checkbox" id="checkShelvedOutOfOrder" v-model="checkShelvedOutOfOrder" />
        <span class="label-text">Check barcodes list for items shelved out of order</span>
      </label>
    </div>
    <div class="section-container">
      <h2>Item Location Filters</h2>
      <div class="form-group">
        <label for="library">Library</label>
        <select
          v-model="selectedLibraryId"
          id="library"
          class="form-control"
          :disabled="librariesLoading"
        >
          <option value="">All Libraries</option>
          <option v-if="librariesLoading" value="loading" disabled>Loading libraries...</option>
          <option
            v-for="library in libraries"
            :key="library.library_id"
            :value="library.library_id"
          >
            {{ library.name }}
          </option>
        </select>
        <div v-if="librariesLoading" class="loading-indicator">Loading libraries...</div>
      </div>
      <div class="form-group">
        <label for="shelvingLocation">Shelving Location</label>
        <select
          v-model="shelvingLocation"
          id="shelvingLocation"
          class="form-control"
          :disabled="shelvingLocationsLoading"
        >
          <option value="" disabled>Select a shelving location</option>
          <option
            v-if="shelvingLocationsLoading && Object.keys(shelvingLocations).length <= 1"
            value="loading"
            disabled
          >
            Loading shelving locations...
          </option>
          <option v-for="item in sortedShelvingLocations" :key="item.code" :value="item.code">
            {{ item.description }}
          </option>
        </select>
        <div v-if="shelvingLocationsLoading" class="loading-indicator">
          Loading shelving locations...
        </div>
      </div>
      <div class="form-group">
        <label for="collectionCode">Collection Code</label>
        <select
          v-model="ccode"
          id="collectionCode"
          class="form-control"
          :disabled="collectionCodesLoading"
        >
          <option value="" disabled>Select a collection code</option>
          <option
            v-if="collectionCodesLoading && Object.keys(collectionCodes).length <= 1"
            value="loading"
            disabled
          >
            Loading collection codes...
          </option>
          <option v-for="item in sortedCollectionCodes" :key="item.code" :value="item.code">
            {{ item.description }}
          </option>
        </select>
        <div v-if="compareBarcodes && ccode" class="help-text info-text">
          <strong>Note:</strong> When using Collection Code with Expected Barcodes, only items with
          this collection code will be included in the expected list.
        </div>
        <div v-if="collectionCodesLoading" class="loading-indicator">
          Loading collection codes...
        </div>
      </div>
      <div>
        <label for="minlocation">Item call number between:</label>
        <input type="text" id="minlocation" v-model="minLocation" class="call-number-input" />
        (items.itemcallnumber)
      </div>
      <div>
        <label for="maxlocation">...and:</label>
        <input type="text" id="maxlocation" v-model="maxLocation" class="call-number-input" />
      </div>
      <div>
        <label for="class_source">Call number classification scheme:</label>
        <select id="class_source" v-model="classSource">
          <option v-for="(source, key) in classSources" :key="key" :value="key">
            {{ source.description }}
          </option>
        </select>
      </div>
    </div>
    <div class="section-container">
      <fieldset id="optionalfilters">
        <legend>Optional filters for inventory list or comparing barcodes</legend>
        <label class="checkbox-option">
          <input type="checkbox" id="skipCheckedOutItems" v-model="skipCheckedOutItems" />
          <span class="label-text">Skip/filter checked out items</span>
          <span class="help-text"
            >(Items that are currently checked out will not appear in the inventory list)</span
          >
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="skipInTransitItems" v-model="skipInTransitItems" />
          <span class="label-text">Skip/filter in-transit items</span>
          <span class="help-text"
            >(Items that are currently in transit will not appear in the inventory list)</span
          >
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="skipBranchMismatchItems" v-model="skipBranchMismatchItems" />
          <span class="label-text">Skip/filter branch mismatch items</span>
          <span class="help-text"
            >(Items where holdingbranch differs from homebranch will not appear in the inventory
            list)</span
          >
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="ignoreWaitingHolds" v-model="ignoreWaitingHolds" />
          <span class="label-text">Skip items on hold awaiting pickup</span>
          <span class="help-text"
            >(Items with waiting holds will not appear in the inventory list)</span
          >
        </label>
        <div class="form-row">
          <label for="datelastseen">Last inventory date:</label>
          <input type="date" id="datelastseen" v-model="dateLastSeen" class="flatpickr" />
          <span class="help-text">(Skip records marked as seen on or after this date.)</span>
        </div>
        <div class="form-group">
          <span class="hint"
            >Scanned items are expected to match one of the selected "not for loan" criteria if any
            are checked.</span
          >
          <br />
          <div id="statuses" class="statuses-grid">
            <div v-for="(statusList, statusKey) in statuses" :key="statusKey" class="status-column">
              <label :for="statusKey">{{ statusKey }}:</label>
              <label
                v-for="status in statusList"
                :key="statusKey + '-' + status.authorised_value_id"
                class="checkbox-option compact"
              >
                <input
                  type="checkbox"
                  :value="status.authorised_value_id"
                  v-model="selectedStatuses[statusKey]"
                />
                <span class="label-text">{{ status.description }}</span>
              </label>
            </div>
          </div>
        </div>
      </fieldset>
      <div class="form-group">
        <label>Item Types</label>
        <div v-if="itemTypesLoading" class="loading-indicator">Loading item types...</div>
        <div class="item-types-grid">
          <label
            v-for="iType in iTypes"
            :key="iType.item_type_id"
            class="checkbox-option compact"
            :class="{ disabled: iType.item_type_id === 'loading' }"
          >
            <input
              type="checkbox"
              :value="iType.item_type_id"
              v-model="selectedItypes"
              :disabled="iType.item_type_id === 'loading'"
            />
            <span class="label-text">{{ iType.description }}</span>
          </label>
        </div>
      </div>
    </div>
    <div class="section-container">
      <h2>Status Alerts</h2>
      <div class="alert-options">
        <label class="checkbox-option">
          <input type="checkbox" id="showWithdrawnAlerts" v-model="showWithdrawnAlerts" />
          <span class="label-text">Show alerts for withdrawn items</span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="showOnHoldAlerts" v-model="showOnHoldAlerts" />
          <span class="label-text">Show alerts for items on hold</span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="showInTransitAlerts" v-model="showInTransitAlerts" />
          <span class="label-text">Show alerts for in-transit items</span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="showBranchMismatchAlerts" v-model="showBranchMismatchAlerts" />
          <span class="label-text">Show alerts for items belonging to different branches</span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="showReturnClaimAlerts" v-model="showReturnClaimAlerts" />
          <span class="label-text">Show alerts for unresolved return claims</span>
        </label>
      </div>
      <p class="help-text">
        These settings control which alert types are displayed during scanning.
      </p>
    </div>
    <div class="section-container">
      <h2>Status Resolution</h2>
      <div class="resolution-options">
        <label class="checkbox-option">
          <input type="checkbox" id="enableManualResolution" v-model="enableManualResolution" />
          <span class="label-text">Enable manual resolution for item issues</span>
          <span class="help-text">
            When enabled, a resolution dialog will appear when scanning items with issues (checked
            out, lost, etc.).
          </span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="resolveLostItems" v-model="resolveLostItems" />
          <span class="label-text">Automatically mark lost items as found</span>
          <span class="help-text">
            When a lost item is scanned, it will be automatically marked as found. If disabled, a
            resolution dialog will appear.
          </span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="resolveReturnClaims" v-model="resolveReturnClaims" />
          <span class="label-text">Automatically resolve return claims when item is scanned</span>
          <span class="help-text">
            When an item with a return claim is scanned, the claim will be automatically resolved.
          </span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="resolveInTransitItems" v-model="resolveInTransitItems" />
          <span class="label-text">Automatically resolve in-transit status to current branch</span>
          <span class="help-text">
            When an item in transit is scanned, the transit will be completed to the current branch.
          </span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="resolveWithdrawnItems" v-model="resolveWithdrawnItems" />
          <span class="label-text">Automatically restore withdrawn items to circulation</span>
          <span class="help-text">
            When a withdrawn item is scanned, it will be automatically restored to circulation.
          </span>
        </label>
      </div>
    </div>

    <div class="section-container">
      <h2>Preview Settings</h2>
      <div class="preview-options">
        <label class="checkbox-option">
          <input type="checkbox" id="enableShelfPreview" v-model="enableShelfPreview" />
          <span class="label-text">Enable shelf preview functionality</span>
          <span class="help-text">
            Allows visualization of upcoming items on the shelf based on call number sequence.
          </span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="showItemIssues" v-model="showItemIssues" />
          <span class="label-text">Show item issues in preview</span>
          <span class="help-text">
            Highlights items with special statuses (checked out, on hold, etc.) in the preview.
          </span>
        </label>
        <label class="checkbox-option">
          <input type="checkbox" id="autoOpenPreview" v-model="autoOpenPreview" />
          <span class="label-text">Auto-open preview on first scan</span>
          <span class="help-text">
            Automatically opens the shelf preview when the first item is scanned.
          </span>
        </label>
      </div>
    </div>

    <button type="submit">Submit</button>
  </form>
</template>

<script>
import { EventBus } from './eventBus'
import { apiService } from '../services/apiService'
import {
  getSession,
  saveSession,
  saveItems,
  getItems,
  clearSession,
  isSessionActive
} from '../services/sessionStorage'

export default {
  props: {
    fetchAuthorizedValues: {
      type: Function,
      required: true
    }
  },
  emits: ['start-session'],
  data() {
    const classSources = window.class_sources || {}
    const defaultClassSource =
      Object.keys(classSources).find((key) => classSources[key].default === 1) || ''
    return {
      branchLoop: '',
      locationLoop: '',
      ccode: '',
      minLocation: '',
      maxLocation: '',
      classSource: defaultClassSource,
      selectedStatuses: {
        'items.itemlost': [],
        'items.notforloan': [],
        'items.withdrawn': [],
        'items.damaged': []
      },
      dateLastSeen: '',
      ignoreIssued: false,
      ignoreWaitingHolds: false,
      compareBarcodes: false,
      doNotCheckIn: false,
      checkShelvedOutOfOrder: false,
      skipCheckedOutItems: true,
      skipInTransitItems: false,
      skipBranchMismatchItems: false,
      showWithdrawnAlerts: true,
      showOnHoldAlerts: true,
      showInTransitAlerts: true,
      showBranchMismatchAlerts: true,
      showReturnClaimAlerts: true,
      resolveReturnClaims: false,
      resolveInTransitItems: false,
      resolveWithdrawnItems: false,
      resolveLostItems: false,
      statuses: {},
      libraries: [],
      selectedLibraryId: '',
      collectionCodes: {},
      classSources: window.class_sources,
      iTypes: [],
      selectedItypes: [],
      inventoryDate: new Date().toISOString().split('T')[0],
      shelvingLocations: {},
      shelvingLocation: '',
      librariesLoading: true,
      itemTypesLoading: true,
      collectionCodesLoading: true,
      shelvingLocationsLoading: true,
      enableManualResolution: true,
      enableShelfPreview: true,
      showItemIssues: true,
      autoOpenPreview: false
    }
  },
  computed: {
    filteredShelvingLocations() {
      const filtered = {}
      Object.entries(this.shelvingLocations || {}).forEach(([key, value]) => {
        if (key && key !== 'loading' && key !== 'undefined' && key !== undefined && key !== null) {
          filtered[key] = value
        }
      })
      return filtered
    },
    filteredCollectionCodes() {
      const filtered = {}
      Object.entries(this.collectionCodes || {}).forEach(([key, value]) => {
        if (key && key !== 'loading' && key !== 'undefined' && key !== undefined && key !== null) {
          filtered[key] = value
        }
      })
      return filtered
    },
    sortedShelvingLocations() {
      return Object.entries(this.filteredShelvingLocations)
        .map(([code, description]) => ({ code, description }))
        .sort((a, b) => a.description.localeCompare(b.description))
    },
    sortedCollectionCodes() {
      return Object.entries(this.filteredCollectionCodes)
        .map(([code, description]) => ({ code, description }))
        .sort((a, b) => a.description.localeCompare(b.description))
    }
  },
  created() {
    // We don't need to load anything in the setup form if it won't be shown
    // (Don't call loadFormData here - it will be called by the parent if needed)
  },
  methods: {
    // New method to load all form data
    loadFormData() {
      this.createStatuses()
      this.fetchLibraries()
      this.fetchCollectionCodes()
      this.fetchItemTypes()
      this.fetchShelvingLocations()
    },

    checkForm() {
      if (
        !(
          this.branchLoop ||
          this.locationLoop ||
          this.ccode ||
          this.minLocation ||
          this.maxLocation ||
          this.classSource ||
          this.selectedStatuses.length
        )
      ) {
        return confirm(
          'You have not selected any catalog filters and are about to compare a file of barcodes to your entire catalog.\n\n' +
            'For large catalogs this can result in unexpected behavior\n\n' +
            'Are you sure you want to do this?'
        )
      }
      return true
    },

    validateForm() {
      // The compareBarcodes checkbox now has a default value of false,
      // so we no longer need to check for null or undefined values.

      // If using compareBarcodes, validate any related fields
      if (this.compareBarcodes) {
        // If no filters are selected, warn user that all items will be in expected list
        if (
          !this.branchLoop &&
          !this.locationLoop &&
          !this.ccode &&
          !this.minLocation &&
          !this.maxLocation &&
          !this.shelvingLocation
        ) {
          const confirmation = confirm(
            'You have enabled barcodes comparison without setting any filters.\n\n' +
              'This means ALL items in your catalog will be in the expected barcodes list.\n\n' +
              'For large catalogs this can cause performance issues.\n\n' +
              'Do you want to continue?'
          )

          if (!confirmation) {
            EventBus.emit('message', {
              type: 'info',
              text: 'Session start cancelled. Please add some filters or disable barcode comparison.'
            })
            return false
          }
        }
      }

      return this.checkForm()
    },

    startInventorySession() {
      // Validate form before submitting
      if (!this.validateForm()) return

      // Validate shelving location filter
      if (this.shelvingLocation) {
        // Check if the shelving location is valid (exists in the loaded locations)
        if (!this.shelvingLocations[this.shelvingLocation]) {
          EventBus.emit('message', {
            type: 'error',
            text: `Invalid shelving location: ${this.shelvingLocation}. Please select a valid shelving location.`
          })
          return // Prevent session from starting
        }

        EventBus.emit('message', {
          type: 'status',
          text: `Applying shelving location filter: ${this.shelvingLocations[this.shelvingLocation] || this.shelvingLocation}`
        })
      }

      // Validate collection code filter when used with compareBarcodes
      if (this.compareBarcodes && this.ccode) {
        // Display a warning about collection code limiting expected barcodes
        EventBus.emit('message', {
          type: 'warning',
          text: `Collection Code filter will limit expected barcodes list to items with collection code: ${this.collectionCodes[this.ccode] || this.ccode}`
        })
      }

      // Display status for checked out items filter
      if (this.skipCheckedOutItems) {
        EventBus.emit('message', {
          type: 'status',
          text: 'Checked out items will be filtered out from inventory'
        })
      }

      // Display status for in-transit items filter
      if (this.skipInTransitItems) {
        EventBus.emit('message', {
          type: 'status',
          text: 'In-transit items will be filtered out from inventory'
        })
      }

      // Display status for branch mismatch items filter
      if (this.skipBranchMismatchItems) {
        EventBus.emit('message', {
          type: 'status',
          text: 'Items with holdingbranch different from homebranch will be filtered out from inventory'
        })
      }

      // Display status for comparing expected barcodes
      if (this.compareBarcodes) {
        EventBus.emit('message', {
          type: 'status',
          text: 'Items will be checked against expected barcodes list'
        })
      } else {
        EventBus.emit('message', {
          type: 'status',
          text: 'All scanned barcodes will be accepted without checking against expected list'
        })
      }

      // Pass the values to the inventory script
      this.$emit('start-session', {
        minLocation: this.minLocation,
        maxLocation: this.maxLocation,
        locationLoop: this.locationLoop,
        branchLoop: this.branchLoop,
        dateLastSeen: this.dateLastSeen,
        ccode: this.ccode,
        classSource: this.classSource,
        selectedStatuses: this.selectedStatuses,
        ignoreIssued: this.skipCheckedOutItems ? true : this.ignoreIssued,
        ignoreWaitingHolds: this.ignoreWaitingHolds,
        selectedItypes: this.selectedItypes,
        selectedLibraryId: this.selectedLibraryId,
        inventoryDate: this.inventoryDate,
        compareBarcodes: this.compareBarcodes,
        doNotCheckIn: this.doNotCheckIn,
        checkShelvedOutOfOrder: this.checkShelvedOutOfOrder,
        skipCheckedOutItems: this.skipCheckedOutItems,
        skipInTransitItems: this.skipInTransitItems,
        skipBranchMismatchItems: this.skipBranchMismatchItems,
        shelvingLocation: this.shelvingLocation,
        alertSettings: {
          showWithdrawnAlerts: this.showWithdrawnAlerts,
          showOnHoldAlerts: this.showOnHoldAlerts,
          showInTransitAlerts: this.showInTransitAlerts,
          showBranchMismatchAlerts: this.showBranchMismatchAlerts,
          showReturnClaimAlerts: this.showReturnClaimAlerts
        },
        resolutionSettings: {
          resolveReturnClaims: this.resolveReturnClaims,
          resolveInTransitItems: this.resolveInTransitItems,
          resolveWithdrawnItems: this.resolveWithdrawnItems,
          resolveLostItems: this.resolveLostItems,
          enableManualResolution: this.enableManualResolution
        },
        previewSettings: {
          enableShelfPreview: this.enableShelfPreview,
          showItemIssues: this.showItemIssues,
          autoOpenPreview: this.autoOpenPreview
        }
      })
    },

    async createStatuses() {
      try {
        const statusFields = {
          'items.itemlost': 'LOST',
          'items.notforloan': 'NOT_LOAN',
          'items.withdrawn': 'WITHDRAWN',
          'items.damaged': 'DAMAGED'
        }

        // Initialize statuses with loading placeholders
        Object.keys(statusFields).forEach((key) => {
          this.statuses[key] = [
            {
              authorised_value_id: 'loading',
              description: 'Loading values...'
            }
          ]
        })

        // Load each category of status fields
        for (const [key, field] of Object.entries(statusFields)) {
          try {
            // Update UI handler - Will be called for each page of results
            const onValuesUpdate = (values) => {
              // Force Vue to recognize the change with a new array
              this.statuses[key] = Object.keys(values).map((k) => ({
                authorised_value_id: k,
                description: values[k]
              }))
            }

            // Call the API
            await this.fetchAuthorizedValues(field, {
              onValuesUpdate // Pass the handler
            })
          } catch (error) {
            console.error(`Error loading ${key} values:`, error)
            EventBus.emit('message', {
              type: 'error',
              text: `Error loading ${key} values: ${error.message}`
            })
          }
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Error creating statuses: ${error.message}`
        })
      }
    },

    async fetchLibraries() {
      try {
        this.librariesLoading = true
        this.libraries = [{ library_id: 'loading', name: 'Loading libraries...' }]

        // Use incremental loading
        await apiService.fetchAllPaginated('/api/v1/public/libraries', {
          artificialDelay: 300, // Add some delay to make the loading visible
          onPageFetched: (items, pageNum) => {
            // Replace the loading placeholder with actual data on first page
            if (pageNum === 1) {
              this.libraries = items
            } else {
              // Add new items for subsequent pages
              this.libraries = [...this.libraries, ...items]
            }

            // Show status message
            EventBus.emit('message', {
              type: 'status',
              text: `Loaded ${this.libraries.length} libraries...`
            })
          }
        })

        this.librariesLoading = false
      } catch (error) {
        this.librariesLoading = false
        EventBus.emit('message', {
          type: 'error',
          text: `Error fetching libraries: ${error.message}`
        })
      }
    },

    async fetchItemTypes() {
      try {
        this.itemTypesLoading = true
        this.iTypes = [{ item_type_id: 'loading', description: 'Loading item types...' }]

        // Use incremental loading
        await apiService.fetchAllPaginated('/api/v1/item_types', {
          artificialDelay: 300,
          onPageFetched: (items, pageNum) => {
            // Replace the loading placeholder with actual data on first page
            if (pageNum === 1) {
              this.iTypes = items
            } else {
              // Add new items for subsequent pages
              this.iTypes = [...this.iTypes, ...items]
            }

            // Show status message
            EventBus.emit('message', {
              type: 'status',
              text: `Loaded ${this.iTypes.length} item types...`
            })
          }
        })

        this.itemTypesLoading = false
      } catch (error) {
        this.itemTypesLoading = false
        EventBus.emit('message', {
          type: 'error',
          text: `Error fetching item types: ${error.message}`
        })
      }
    },

    async fetchCollectionCodes() {
      try {
        this.collectionCodesLoading = true
        this.collectionCodes = { loading: 'Loading collection codes...' }

        await this.fetchAuthorizedValues('CCODE', {
          onValuesUpdate: (values) => {
            // Make a clean copy of the values object that Vue can track
            this.collectionCodes = { ...values }

            // Remove loading placeholder when real data arrives
            if (Object.keys(this.collectionCodes).length > 0 && this.collectionCodes.loading) {
              delete this.collectionCodes.loading
            }
          }
        })

        this.collectionCodesLoading = false
      } catch (error) {
        this.collectionCodesLoading = false
        EventBus.emit('message', {
          type: 'error',
          text: `Error fetching collection codes: ${error.message}`
        })
      }
    },

    async fetchShelvingLocations() {
      try {
        this.shelvingLocationsLoading = true
        this.shelvingLocations = { loading: 'Loading shelving locations...' }

        await this.fetchAuthorizedValues('LOC', {
          onValuesUpdate: (values) => {
            // Make a clean copy of the values object that Vue can track
            this.shelvingLocations = { ...values }

            // Remove loading placeholder when real data arrives
            if (Object.keys(this.shelvingLocations).length > 0 && this.shelvingLocations.loading) {
              delete this.shelvingLocations.loading
            }
          }
        })

        this.shelvingLocationsLoading = false
      } catch (error) {
        this.shelvingLocationsLoading = false
        EventBus.emit('message', {
          type: 'error',
          text: `Error fetching shelving locations: ${error.message}`
        })
      }
    }
  }
}
</script>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  line-height: 2;
}

label {
  margin-top: 10px;
}

button {
  margin-top: 20px;
}

.statuses-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  /* Ensure all columns fit in one row */
  gap: 16px;
}

.status-column {
  display: flex;
  flex-direction: column;
}

/* Add media query for mobile responsiveness */
@media (max-width: 767px) {
  .statuses-grid {
    grid-template-columns: repeat(2, 1fr); /* Change to 2 columns on medium screens */
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .statuses-grid {
    grid-template-columns: 1fr; /* Stack vertically on very small screens */
  }

  .status-column {
    margin-bottom: 16px;
  }

  .status-column label {
    font-weight: bold; /* Make column headers more visible */
    margin-bottom: 8px;
    display: block;
  }
}

.form-group {
  margin-bottom: 1rem;
}

/* Clickable checkbox option - uses label as wrapper for native click behavior */
.checkbox-option {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  margin: 0.375rem 0.375rem 0.375rem 0;
  cursor: pointer;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  background-color: #f8f9fa;
  transition: all 0.15s ease-in-out;
  user-select: none;
  -webkit-user-select: none;
}

.checkbox-option:hover {
  background-color: #f8f9fa;
  border-color: #adb5bd;
}

.checkbox-option:has(input:checked) {
  background-color: #e7f1ff;
  border-color: #86b7fe;
}

.checkbox-option:has(input:checked):hover {
  background-color: #cfe2ff;
}

.checkbox-option.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.checkbox-option.compact {
  padding: 0.5rem 0.625rem;
  margin: 0.25rem 0;
}

.checkbox-option input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  margin: 0;
  cursor: pointer;
}

.checkbox-option.disabled input[type='checkbox'] {
  cursor: not-allowed;
}

.checkbox-option .label-text {
  font-weight: 500;
  line-height: 1.4;
}

.checkbox-option .help-text {
  grid-column: 2;
  justify-self: start;
  font-size: 0.85rem;
  color: #495057;
  background-color: #f1f3f4;
  border-left: 3px solid #2196f3;
  padding: 0.375rem 0.5rem;
  margin-top: 0.375rem;
  border-radius: 0 4px 4px 0;
}

.form-control {
  width: 100%;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #495057;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  transition:
    border-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.section-container {
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  padding: 15px;
  background-color: #fff;
  margin-top: 10px;
}

.item-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.no-numbering {
  list-style-type: none;
  padding-left: 0;
}

fieldset {
  padding: 0px;
  margin: 0px;
}

.call-number-input {
  flex: 1;
  max-width: 200px;
  /* Set a max-width to prevent stretching */
}

.loading-indicator {
  font-size: 0.8rem;
  color: #666;
  margin-top: 4px;
  font-style: italic;
  animation: pulse 1.5s infinite;
}

.help-text {
  font-size: 0.8rem;
  color: #666;
  margin-top: 4px;
}

.info-text {
  background-color: #e3f2fd;
  border-left: 3px solid #2196f3;
  padding: 8px;
  margin-top: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #0d47a1;
}

.alert-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.alert-option {
  padding: 8px;
  border-radius: 4px;
  background-color: #f8f9fa;
  transition: background-color 0.2s;
}

.alert-option:hover {
  background-color: #e9ecef;
}

.alert-option label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.alert-option input[type='checkbox'] {
  margin-right: 10px;
}

.resolution-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.resolution-option {
  padding: 12px;
  border-radius: 4px;
  background-color: #f5f5f5;
  border-left: 3px solid #4caf50;
  transition: background-color 0.2s;
}

.resolution-option:hover {
  background-color: #e8f5e9;
}

.resolution-option label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 8px;
}

.resolution-option input[type='checkbox'] {
  margin-right: 10px;
}

/* Adding a subtle pulsing animation for loading states */
@keyframes pulse {
  0% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.6;
  }
}
</style>
