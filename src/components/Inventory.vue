<template>
  <div class="container">
    <InventorySetupForm ref="setupForm" @start-session="initiateInventorySession"
      :fetchAuthorizedValues="fetchAuthorizedValues" v-if="!sessionStarted" />
    <div v-else>
      <div class="barcode-input-container">
        <form @submit.prevent="submitBarcode" class="barcode-form">
          <div class="input-group">
            <input type="text" v-model="barcode" id="barcode_input" ref="barcodeInput" autocomplete="off"
              placeholder="Enter or scan a barcode..." :disabled="scannerMode" />
            <button type="button" @click="toggleScannerMode" class="camera-button" :class="{ active: scannerMode }">
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
          <InventoryItem :item="latestItem" :index="0" :isExpanded="true" @toggleExpand="() => { }"
            :fetchAuthorizedValues="fetchAuthorizedValues" :sessionData="sessionData"
            :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
            :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber" :alert-settings="alertSettings" />
        </div>
      </div>

      <!-- Manual mode - full width layout -->
      <div v-if="!scannerMode" class="manual-mode-results">
        <div v-if="latestItem" class="latest-scan-panel">
          <h3>Latest Scan</h3>
          <InventoryItem :item="latestItem" :index="0" :isExpanded="true" @toggleExpand="() => { }"
            :fetchAuthorizedValues="fetchAuthorizedValues" :sessionData="sessionData"
            :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
            :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber" :alert-settings="alertSettings" />
        </div>

        <div id="inventory_results" class="items-list">
          <h3>Previous Scans</h3>
          <p v-if="previousItems.length === 0" class="no-items-message">No previous scans yet.</p>
          <InventoryItem v-for="(item, index) in previousItems" :key="`${index}-${item.id}`" :item="item"
            :index="index + 1" :isExpanded="item.isExpanded" @toggleExpand="handleToggleExpand"
            :fetchAuthorizedValues="fetchAuthorizedValues" :sessionData="sessionData"
            :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
            :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber" :alert-settings="alertSettings" />
        </div>
      </div>

      <!-- Only show this in scanner mode -->
      <div v-if="scannerMode" class="result-panel">
        <div id="inventory_results" class="items-list">
          <h3>Previous Scans</h3>
          <p v-if="previousItems.length === 0" class="no-items-message">No previous scans yet.</p>
          <InventoryItem v-for="(item, index) in previousItems" :key="`${index}-${item.id}`" :item="item"
            :index="index + 1" :isExpanded="item.isExpanded" @toggleExpand="handleToggleExpand"
            :fetchAuthorizedValues="fetchAuthorizedValues" :sessionData="sessionData"
            :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
            :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber" :alert-settings="alertSettings" />
        </div>
      </div>
    </div>
    <button v-if="sessionStarted" @click="toggleEndSessionModal" class="end-session-button">End Session</button>

    <!-- End Session Modal -->
    <div v-if="showEndSessionModal" class="modal">
      <div class="modal-content">
        <span @click="showEndSessionModal = false" class="close">&times;</span>
        <h2>End Session</h2>
        <p v-if="uniqueBarcodesCount <= expectedUniqueBarcodes">Scanned {{ uniqueBarcodesCount }} unique barcodes of an
          expected {{ expectedUniqueBarcodes }} are you sure you want to end the session?</p>
        <div class="modal-checkboxes">
          <input type="checkbox" id="exportToCSV" v-model="exportToCSV"> Export to CSV
        </div>
        <div class="modal-checkboxes">
          <input type="checkbox" v-model="markMissingItems" id="mark-missing-items"> Mark "loststatus" as missing for
          any expected items not scanned
        </div>
        <span v-if="markMissingItems" style="color: red;">(This can take a while for large numbers of missing
          items)</span>
        <button @click="endSession" class="end-session-modal-button">End Session</button>
      </div>
    </div>
  </div>
</template>

<script>
import InventorySetupForm from './InventorySetupForm.vue'
import InventoryItem from './InventoryItem.vue'
import BarcodeScanner from './BarcodeScanner.vue'
import { EventBus } from './eventBus'
import { sessionStorage } from '../services/sessionStorage'
import { apiService } from '../services/apiService'

export default {
  components: {
    InventorySetupForm,
    InventoryItem,
    BarcodeScanner
  },
  computed: {
    uniqueBarcodesCount() {
      const uniqueBarcodes = new Set(this.items.map(item => item.external_id));
      return uniqueBarcodes.size;
    },
    expectedUniqueBarcodes() {
      return this.sessionData && this.sessionData.response_data ? (this.sessionData.response_data.total_records || 0) : 0;
    },
    latestItem() {
      return this.items.length > 0 ? this.items[0] : null;
    },
    previousItems() {
      return this.items.slice(1);
    }
  },
  data() {
    return {
      barcode: '',
      scannerMode: false,
      items: [],
      sessionData: null,
      sessionStarted: false,
      highestCallNumberSort: '',
      itemWithHighestCallNumber: '',
      biblioWithHighestCallNumber: '',
      showEndSessionModal: false,
      exportToCSV: false,
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
      ignoreLostStatus: false,
      statuses: {},
      locations: {}
    };
  },
  mounted() {
    // Check for existing session on component mount
    this.checkForExistingSession();

    // Check if the user is on a mobile device
    this.checkDeviceType();

    // Add a resize listener to update the layout when window size changes
    window.addEventListener('resize', this.checkDeviceType);
  },

  beforeUnmount() {
    // Clean up the resize event listener
    window.removeEventListener('resize', this.checkDeviceType);
  },
  methods: {
    checkForExistingSession() {
      if (sessionStorage.isSessionActive()) {
        const savedSessionData = sessionStorage.getSession();
        const savedItems = sessionStorage.getItems();

        if (savedSessionData) {
          this.sessionData = savedSessionData;
          this.sessionStarted = true;

          if (savedItems) {
            this.items = savedItems;

            // Restore the highest call number tracking
            this.updateHighestCallNumber();
          }

          EventBus.emit('message', { text: 'Session restored successfully', type: 'status' });

          // Focus on barcode input after a short delay to ensure the DOM is ready
          this.$nextTick(() => {
            if (this.$refs.barcodeInput) {
              this.$refs.barcodeInput.focus();
            }
          });
        }
      } else {
        // Only load form data if we're showing the form (no active session)
        this.$nextTick(() => {
          if (this.$refs.setupForm) {
            this.$refs.setupForm.loadFormData();
          }
        });
      }
    },

    updateHighestCallNumber() {
      // Find the item with the highest call number sort value
      if (this.items.length > 0) {
        let highestSortValue = '';
        let highestItemBarcode = '';
        let highestBiblioId = '';

        this.items.forEach(item => {
          if (item.call_number_sort > highestSortValue) {
            highestSortValue = item.call_number_sort;
            highestItemBarcode = item.external_id;
            highestBiblioId = item.biblio_id;
          }
        });

        this.highestCallNumberSort = highestSortValue;
        this.itemWithHighestCallNumber = highestItemBarcode;
        this.biblioWithHighestCallNumber = highestBiblioId;
      }
    },

    async endSession() {
      try {
        let operationsCompleted = false;

        // Disable the button to prevent multiple clicks during processing
        const endSessionButton = document.querySelector('.end-session-modal-button');
        if (endSessionButton) {
          endSessionButton.disabled = true;
          endSessionButton.textContent = 'Processing...';
        }

        if (this.exportToCSV) {
          // Export to CSV first
          await this.exportDataToCSV();
        }

        if (this.markMissingItems) {
          // Add defensive check for location_data
          const locationData = this.sessionData.response_data.location_data || [];
          const scannedBarcodesSet = new Set(this.items.map(item => item.external_id));
          
          // Filter out items that are checked out if skipCheckedOutItems is enabled
          const missingItems = locationData.filter(item => {
            // Skip items that have already been scanned
            if (scannedBarcodesSet.has(item.barcode)) {
              return false;
            }
            
            // Skip items that are checked out if the session is configured to do so
            if (this.sessionData.skipCheckedOutItems && item.checked_out) {
              console.log(`Skipping checked out item: ${item.barcode}`);
              return false;
            }
            
            // Skip items that are in transit if the session is configured to do so
            if (this.sessionData.skipInTransitItems && item.in_transit) {
              console.log(`Skipping in-transit item: ${item.barcode}`);
              return false;
            }
            
            // Skip items that have branch mismatch if the session is configured to do so
            if (this.sessionData.skipBranchMismatchItems && item.homebranch !== item.holdingbranch) {
              console.log(`Skipping branch mismatch item: ${item.barcode} (homebranch: ${item.homebranch}, holdingbranch: ${item.holdingbranch})`);
              return false;
            }
            
            return true;
          });

          if (missingItems.length > 0) {
            // Show processing message
            EventBus.emit('message', { text: `Processing ${missingItems.length} missing items...`, type: 'status' });

            // Mark missing items
            const itemsToUpdate = missingItems.map(item => ({
              barcode: item.barcode,
              fields: { itemlost: 4 }
            }));

            try {
              // Wait for the update to complete
              await this.updateItemStatus(itemsToUpdate);
              // Signal completion
              EventBus.emit('message', { text: 'Items marked as missing successfully', type: 'status' });
              
              // Count skipped items
              let skippedCheckedOut = 0;
              let skippedInTransit = 0;
              let skippedBranchMismatch = 0;
              
              locationData.forEach(item => {
                if (!scannedBarcodesSet.has(item.barcode) && !missingItems.includes(item)) {
                  if (this.sessionData.skipCheckedOutItems && item.checked_out) {
                    skippedCheckedOut++;
                  } else if (this.sessionData.skipInTransitItems && item.in_transit) {
                    skippedInTransit++;
                  } else if (this.sessionData.skipBranchMismatchItems && item.homebranch !== item.holdingbranch) {
                    skippedBranchMismatch++;
                  }
                }
              });
              
              // Show summary of skipped items
              if (skippedCheckedOut > 0) {
                EventBus.emit('message', { 
                  text: `${skippedCheckedOut} checked out items were skipped from being marked as missing`, 
                  type: 'status' 
                });
              }
              
              if (skippedInTransit > 0) {
                EventBus.emit('message', { 
                  text: `${skippedInTransit} in-transit items were skipped from being marked as missing`, 
                  type: 'status' 
                });
              }
              
              if (skippedBranchMismatch > 0) {
                EventBus.emit('message', { 
                  text: `${skippedBranchMismatch} items with branch mismatch were skipped from being marked as missing`, 
                  type: 'status' 
                });
              }
            } catch (error) {
              EventBus.emit('message', { text: `Error marking items as missing: ${error.message}`, type: 'error' });
              throw error; // Re-throw to prevent page reload if marking items fails
            }
          } else {
            EventBus.emit('message', { text: 'No missing items to mark', type: 'status' });
          }
        }

        // Mark operations as completed
        operationsCompleted = true;

        // Clear session storage
        sessionStorage.clearSession();

        // Close the modal
        this.showEndSessionModal = false;

        // Reset component state
        this.sessionStarted = false;
        this.sessionData = null;
        this.items = [];

        // Wait a moment to make sure the user sees the success message
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Reload the page to start fresh
        window.location.reload();
      } catch (error) {
        // Re-enable the button on error
        const endSessionButton = document.querySelector('.end-session-modal-button');
        if (endSessionButton) {
          endSessionButton.disabled = false;
          endSessionButton.textContent = 'End Session';
        }

        EventBus.emit('message', { text: `Error ending session: ${error.message}`, type: 'error' });
      }
    },

    async updateItemStatus(items = []) {
      if (!items || items.length === 0) {
        return; // No items to update
      }

      try {
        console.log('Updating multiple item statuses:', items);

        // Add progress indicator for large batches
        if (items.length > 50) {
          EventBus.emit('message', { text: `Processing ${items.length} items, please wait...`, type: 'status' });
        }

        // Use the improved apiService instead of direct fetch
        const data = await apiService.post(
          `/api/v1/contrib/interactiveinventory/item/fields`,
          { items }
        );

        return data; // Return the response data
      } catch (error) {
        console.error('Error updating item statuses:', error);
        EventBus.emit('message', { text: `Error updating item statuses: ${error.message}`, type: 'error' });
        throw error; // Re-throw the error to be handled by the caller
      }
    },

    async fetchAuthorizedValues(category, options = {}) {
      try {
        // If we're in an active session, handle differently for efficiency
        if (this.sessionStarted && !options.forceLoad) {
          const cacheKey = `authorizedValues_${category}`;
          const cachedValues = localStorage.getItem(cacheKey);

          if (cachedValues) {
            const parsedValues = JSON.parse(cachedValues);
            if (options.onValuesUpdate) {
              options.onValuesUpdate(parsedValues);
            }
            return parsedValues;
          }

          // In scanner mode, just return empty object if no cache to avoid API call
          return {};
        }

        // Otherwise proceed with normal implementation for setup form
        const combinedOptions = {
          ...options,
          onProgress: (progress) => {
            if (progress.loaded % 100 === 0 || progress.loaded === progress.total) {
              EventBus.emit('message', {
                type: 'status',
                text: `Loading ${category} values: ${progress.loaded}${progress.total ? '/' + progress.total : ''}`
              });
            }
          }
        };

        return await apiService.fetchAuthorizedValues(category, combinedOptions);
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: `Error fetching authorized values: ${error.message}` });
        throw error;
      }
    },

    async submitBarcode() {
      if (!this.barcode) {
        return;
      }

      if (this.loading) {
        return;
      }

      this.loading = true;
      this.lastScannedBarcode = this.barcode;

      try {
        EventBus.emit('message', { type: 'status', text: 'Searching for item...' });

        // First get all items with this barcode (usually just one)
        let response = await fetch(`/api/v1/items?external_id=${encodeURIComponent(this.barcode)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.statusText}`);
        }

        const items = await response.json();

        if (!items || items.length === 0) {
          throw new Error('Item not found: ' + this.barcode);
        }

        const itemData = items[0];

        if (!itemData.biblio_id) {
          throw new Error('Item found but missing biblio data: ' + this.barcode);
        }

        // Check if the item is checked out and the user has chosen to skip checked out items
        if (this.sessionData.skipCheckedOutItems && itemData.checked_out_date) {
          EventBus.emit('message', { 
            type: 'warning', 
            text: `Item ${this.barcode} is currently checked out. Skipping according to settings.` 
          });
          
          // Clear the barcode input and focus on it
          this.barcode = '';
          if (this.$refs.barcodeInput) {
            this.$refs.barcodeInput.focus();
          }
          
          return; // Skip processing this item
        }
        
        // Check if the item is in transit and the user has chosen to skip in-transit items
        if (this.sessionData.skipInTransitItems && itemData.in_transit) {
          EventBus.emit('message', { 
            type: 'warning', 
            text: `Item ${this.barcode} is currently in transit. Skipping according to settings.` 
          });
          
          // Clear the barcode input and focus on it
          this.barcode = '';
          if (this.$refs.barcodeInput) {
            this.$refs.barcodeInput.focus();
          }
          
          return; // Skip processing this item
        }

        // Check if the item has branch mismatch and the user has chosen to skip such items
        if (this.sessionData.skipBranchMismatchItems && itemData.homebranch !== itemData.holdingbranch) {
          EventBus.emit('message', { 
            type: 'warning', 
            text: `Item ${this.barcode} has different holding branch (${itemData.holdingbranch}) than home branch (${itemData.homebranch}). Skipping according to settings.` 
          });
          
          // Clear the barcode input and focus on it
          this.barcode = '';
          if (this.$refs.barcodeInput) {
            this.$refs.barcodeInput.focus();
          }
          
          return; // Skip processing this item
        }

        EventBus.emit('message', { type: 'status', text: 'Fetching bibliographic details...' });

        // Fetch the biblio data - Add Accept header to fix the Not Acceptable error
        response = await fetch(`/api/v1/biblios/${itemData.biblio_id}`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch biblio: ${response.statusText}`);
        }

        const biblioData = await response.json();

        // Combine item data and biblio data
        const combinedData = { ...itemData, biblio: biblioData };

        // Add running 'fields to amend' variable
        var fieldsToAmend = {};

        if (this.sessionData.inventoryDate > combinedData.last_seen_date)
          fieldsToAmend["datelastseen"] = this.sessionData.inventoryDate;

        // Check various status flags
        this.checkItemSpecialStatuses(combinedData);

        // Only check scanned barcodes against expected list if compareBarcodes is enabled
        if (this.sessionData.compareBarcodes) {
          // Add defensive check before accessing right_place_list
          const rightPlaceList = this.sessionData.response_data.right_place_list || [];
          const isInRightPlaceList = rightPlaceList.some(item => item.barcode === combinedData.external_id);
          if (!isInRightPlaceList) {
            combinedData.wrongPlace = true; // Flag the item as in the wrong place
            EventBus.emit('message', { 
              type: 'warning', 
              text: `Item ${combinedData.external_id} is not in the expected barcodes list` 
            });
          } else {
            EventBus.emit('message', { 
              type: 'status', 
              text: `Item ${combinedData.external_id} found in expected barcodes list` 
            });
          }
        }

        if (combinedData.checked_out_date && !this.sessionData.doNotCheckIn) {
          await this.checkInItem(combinedData.external_id);
        }

        // Check if the item is marked as lost and update its status
        if (combinedData.lost_status != "0") {
          combinedData.wasLost = true; // Flag the item as previously lost
          //add the key-value pair to the fields to amend object
          if (!this.sessionData.ignoreLostStatus) {
            fieldsToAmend["itemlost"] = '0';
          }
        }

        if (this.sessionData.checkShelvedOutOfOrder && combinedData.call_number_sort < this.highestCallNumberSort) {
          combinedData.outOfOrder = 1;
        } else {
          this.highestCallNumberSort = combinedData.call_number_sort;
          this.itemWithHighestCallNumber = combinedData.external_id;
          this.biblioWithHighestCallNumber = combinedData.biblio_id;
        }

        if (this.sessionData.selectedStatuses && Object.values(this.sessionData.selectedStatuses).some(statusArray => statusArray.length > 0)) {
          this.checkItemStatuses(combinedData, this.sessionData.selectedStatuses);
        }

        combinedData.wasScanned = true;

        // Prepend the combined data to the items array
        this.items.unshift(combinedData);

        // Set all items to be collapsed except the first one
        this.items = this.items.map((item, index) => ({
          ...item,
          isExpanded: index === 0 // Only expand the first item
        }));

        // Update the item status - using the single item endpoint
        if (Object.keys(fieldsToAmend).length > 0) {
          await this.updateSingleItemStatus(combinedData.external_id, fieldsToAmend);
        }

        // Save updated items to session storage
        sessionStorage.saveItems(this.items);

        // Clear the barcode input and focus on it
        this.barcode = '';
        if (this.$refs.barcodeInput) {
          this.$refs.barcodeInput.focus();
        }

        EventBus.emit('message', { type: 'status', text: 'Item scanned successfully' });
      } catch (error) {
        console.error(error);
        EventBus.emit('message', { text: `Error scanning barcode: ${error.message}`, type: 'error' });
      } finally {
        this.loading = false;
      }
    },

    async checkInItem(barcode) {
      try {
        const data = await apiService.post(
          `/api/v1/contrib/interactiveinventory/item/checkin`,
          {
            barcode: barcode,
            date: this.sessionData.inventoryDate
          }
        );
        
        EventBus.emit('message', { text: 'Item checked in successfully', type: 'status' });
        return data;
      } catch (error) {
        EventBus.emit('message', { text: `Error checking in item: ${error.message}`, type: 'error' });
        // Don't throw - we want to continue processing other items even if check-in fails
        return { error: error.message };
      }
    },

    async updateSingleItemStatus(barcode, fields) {
      try {
        console.log('Updating single item status:', barcode, fields);
        
        // Use the improved apiService
        const data = await apiService.post(
          `/api/v1/contrib/interactiveinventory/item/field`,
          { barcode, fields }
        );
        
        EventBus.emit('message', { text: 'Item status updated successfully', type: 'status' });
        return data;
      } catch (error) {
        EventBus.emit('message', { text: `Error updating item status: ${error.message}`, type: 'error' });
        throw error;
      }
    },

    async initiateInventorySession(sessionData) {
      this.sessionData = sessionData;
      this.sessionStarted = true;
      try {
        // Display filter information to the user
        if (sessionData.shelvingLocation) {
          const locationName = sessionData.shelvingLocations && sessionData.shelvingLocations[sessionData.shelvingLocation]
            ? sessionData.shelvingLocations[sessionData.shelvingLocation]
            : sessionData.shelvingLocation;
          EventBus.emit('message', { 
            type: 'status', 
            text: `Applying shelving location filter: ${locationName}` 
          });
        }
        
        // Display comparison mode
        if (sessionData.compareBarcodes) {
          EventBus.emit('message', { 
            type: 'status', 
            text: 'Expected barcodes comparison mode is ON. Generating expected barcodes list...' 
          });
        } else {
          EventBus.emit('message', { 
            type: 'status', 
            text: 'Expected barcodes comparison mode is OFF. No expected barcodes list will be generated.' 
          });
        }
        
        EventBus.emit('message', { type: 'status', text: 'Starting inventory session...' });
        
        // Make the API request with improved error handling
        const response = await fetch(
          `/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=start_session&session_data=${encodeURIComponent(JSON.stringify(sessionData))}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );

        // Check for HTTP errors
        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
          } else {
            const errorText = await response.text();
            throw new Error(`Non-JSON error response: ${errorText || response.statusText}`);
          }
        }

        // Parse the JSON response with error handling
        let data;
        try {
          const responseText = await response.text();
          try {
            data = JSON.parse(responseText);
          } catch (jsonError) {
            console.error('JSON Parse Error:', jsonError, 'Response text:', responseText);
            throw new Error(`Invalid JSON response: ${jsonError.message}`);
          }
        } catch (textError) {
          console.error('Error reading response text:', textError);
          throw new Error('Unable to read response data');
        }

        // Validate response data
        if (!data) {
          throw new Error('Empty response received');
        }
        
        // Check for API error in the response
        if (data.error) {
          throw new Error(`API error: ${data.error}`);
        }

        // Validate expected data structure
        if (!data.location_data || !Array.isArray(data.location_data)) {
          console.warn('Invalid location_data in response:', data);
          data.location_data = [];
        }
        
        if (!data.right_place_list || !Array.isArray(data.right_place_list)) {
          console.warn('Invalid right_place_list in response:', data);
          data.right_place_list = [];
        }

        this.sessionData.response_data = data;

        // Save session data to session storage
        sessionStorage.saveSession(this.sessionData);

        // Clear any existing items
        this.items = [];
        sessionStorage.saveItems(this.items);

        // Provide information about expected barcodes list based on compareBarcodes setting
        if (this.sessionData.compareBarcodes) {
          const rightPlaceList = data.right_place_list || [];
          if (rightPlaceList.length > 0) {
            EventBus.emit('message', {
              text: `Expected barcodes list contains ${rightPlaceList.length} items. Items not on this list will be flagged.`, 
              type: 'status'
            });
            
            // Check if collection code is used and provide additional info
            if (this.sessionData.ccode) {
              EventBus.emit('message', {
                text: `Expected barcodes list is filtered by collection code: ${this.sessionData.ccode}`,
                type: 'info'
              });
            }
          } else {
            // The list might be empty because of a collection code filter
            if (this.sessionData.ccode) {
              EventBus.emit('message', {
                text: `Expected barcodes list is empty, possibly because of the collection code filter (${this.sessionData.ccode}). No items will be marked as unexpected.`,
                type: 'warning'
              });
            } else {
              EventBus.emit('message', {
                text: 'Expected barcodes list is empty. No items will be marked as unexpected.',
                type: 'warning'
              });
            }
          }
        } else {
          EventBus.emit('message', {
            text: 'Not comparing scanned items to an expected barcodes list. All scanned items will be accepted.',
            type: 'status'
          });
        }

        EventBus.emit('message', { 
          text: `Inventory session started with ${data.total_records || 0} items`, 
          type: 'status' 
        });
      } catch (error) {
        console.error('Inventory session error:', error);
        this.sessionStarted = false;
        this.sessionData = null;
        
        EventBus.emit('message', { 
          text: `Error starting inventory session: ${error.message}`, 
          type: 'error' 
        });
        
        // Show additional guidance if JSON parsing failed
        if (error.message.includes('JSON')) {
          EventBus.emit('message', { 
            text: 'There was a problem with the server response. Please try again or contact support.', 
            type: 'error' 
          });
        }
      }
    },

    handleToggleExpand(itemId) {
      this.items = this.items.map((item, index) => ({
        ...item,
        isExpanded: `${index}-${item.id}` === itemId ? !item.isExpanded : false // Toggle the clicked item, collapse others
      }));
    },

    exportDataToCSV() {
      const headers = [
        'Barcode', 'Item ID', 'Biblio ID', 'Title', 'Author', 'Publication Year', 'Publisher', 'ISBN', 'Pages', 'Location', 'Acquisition Date', 'Last Seen Date', 'URL', 'Was Lost', 'Wrong Place', 'Was Checked Out', 'Scanned Out of Order', 'Had Invalid "Not for loan" Status', 'Scanned'
      ];

      // Create a map of scanned items using their barcodes
      const scannedItemsMap = new Map(this.items.map(item => [item.external_id, item]));

      // Add defensive check for location_data
      const locationData = this.sessionData.response_data.location_data || [];
      const expectedBarcodesSet = new Set(locationData.map(item => item.barcode));

      // Combine expected items and scanned items
      const combinedItems = [
        ...locationData,
        ...this.items.filter(item => !expectedBarcodesSet.has(item.external_id))
      ];
      console.log(combinedItems);

      const csvContent = [
        headers.join(','),
        ...combinedItems.map(item => {
          const scannedItem = scannedItemsMap.get(item.barcode);
          const combinedItem = { ...item };

          if (scannedItem) {
            for (const key in scannedItem) {
              if (!combinedItem.hasOwnProperty(key) || combinedItem[key] === null || combinedItem[key] === undefined) {
                combinedItem[key] = scannedItem[key];
              }
            }
          }
          const wasScanned = scannedItem || combinedItem.wasScanned;

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
            `"${combinedItem.location}"`,
            `"${combinedItem.acquisition_date || 'N/A'}"`,
            `"${combinedItem.datelastseen || combinedItem.last_seen_date || 'N/A'}"`,
            `"${window.location.origin}/cgi-bin/koha/catalogue/detail.pl?biblionumber=${combinedItem.biblionumber || combinedItem.biblio_id}"`,
            `"${combinedItem.wasLost === '1' ? 'Yes' : 'No'}"`,
            `"${combinedItem.wrongPlace ? 'Yes' : 'No'}"`,
            `"${combinedItem.checked_out_date ? 'Yes' : 'No'}"`,
            `"${combinedItem.outOfOrder ? 'Yes' : 'No'}"`,
            `"${combinedItem.invalidStatus ? 'Yes' : 'No'}"`,
            `"${wasScanned ? 'Yes' : 'NOT SCANNED'}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    checkItemStatuses(item, selectedStatuses) {
      // Initialize invalidStatus as an object
      item.invalidStatus = {};

      const statusKeyValuePairs = {
        'items.itemlost': item.lost_status,
        'items.notforloan': item.damaged_status,
        'items.withdrawn': item.withdrawn,
        'items.damaged': item.not_for_loan_status,
      };

      for (const [key, value] of Object.entries(statusKeyValuePairs)) {
        if (value != "0" && (!selectedStatuses[key].includes(String(value)))) {
          console.log('Invalid status:', key, value);
          item.invalidStatus['key'] = key; // Flag the item as having an invalid status
          item.invalidStatus['value'] = value;
          break;
        }
      }
    },

    checkItemSpecialStatuses(item) {
      // Check for withdrawn items
      if (item.withdrawn === '1' && this.alertSettings.showWithdrawnAlerts) {
        EventBus.emit('message', {
          type: 'warning',
          text: `${item.title} (${item.barcode}) has been withdrawn from circulation`
        });
      }

      // Check for holds
      if (item.on_hold && this.alertSettings.showOnHoldAlerts) {
        let holdMsg = `${item.title} (${item.barcode}) has a hold placed on it`;
        
        if (item.waiting) {
          holdMsg += ' and is waiting for pickup';
        } else if (item.in_transit) {
          holdMsg += ' and is in transit to fulfill the hold';
        }
        
        EventBus.emit('message', {
          type: 'warning',
          text: holdMsg
        });
      }

      // Check for in transit items
      if (item.in_transit && this.alertSettings.showInTransitAlerts) {
        EventBus.emit('message', {
          type: 'warning',
          text: `${item.title} (${item.barcode}) is in transit from ${item.homebranch} to ${item.holdingbranch}`
        });
      }
      
      // Check for branch mismatch
      if (item.homebranch !== item.holdingbranch && this.alertSettings.showBranchMismatchAlerts) {
        EventBus.emit('message', {
          type: 'info',
          text: `${item.title} (${item.barcode}) belongs to ${item.homebranch} but is currently at ${item.holdingbranch}`
        });
      }

      // Check for return claims
      if (item.return_claim && this.alertSettings.showReturnClaimAlerts) {
        EventBus.emit('message', {
          type: 'warning',
          text: `${item.title} (${item.barcode}) has an unresolved return claim. Patron claims they returned it, but it's still checked out.`
        });
      }
    },

    toggleScannerMode() {
      // First, force the scanner to stop and release camera
      if (this.scannerMode) {
        // If we're currently in scanner mode, make sure it's cleaned up
        try {
          EventBus.emit('stop-scanner');
          // Give time for camera to release before toggling mode
          setTimeout(() => {
            this.scannerMode = false;
          }, 200);
        } catch (e) {
          this.scannerMode = false;
        }
      } else {
        // If we're not in scanner mode, we can switch immediately
        this.scannerMode = true;
      }
    },

    onBarcodeDetected(code) {
      this.barcode = code;
      this.submitBarcode();

      // Show confirmation to the user
      EventBus.emit('message', {
        type: 'status',
        text: `Barcode detected: ${code}`
      });
    },

    checkDeviceType() {
      this.isMobileView = window.innerWidth < 768;
    },

    toggleEndSessionModal() {
      console.log('Toggle modal', this.showEndSessionModal);
      this.showEndSessionModal = !this.showEndSessionModal;
    },

    setupStarted(data) {
      this.session_id = data.id;
      this.inventoryDate = data.inventoryDate;
      this.currentLibrary = data.library;
      this.shelvingLocation = data.shelvingLocation;
      this.skipCheckedOutItems = data.skipCheckedOutItems;
      this.skipInTransitItems = data.skipInTransitItems;
      this.skipBranchMismatchItems = data.skipBranchMismatchItems;
      this.doNotCheckIn = data.doNotCheckIn;
      this.checkShelvedOutOfOrder = data.checkShelvedOutOfOrder;
      this.ignoreLostStatus = data.ignoreLostStatus;
      this.statuses = data.statuses;
      this.locations = data.locations;
      this.compareBarcodes = data.compareBarcodes;
      this.locationCode = data.collectionCode || '';
      
      // Handle alert settings
      if (data.alertSettings) {
        this.alertSettings = data.alertSettings;
      }
      
      // Log the status of alerts for debugging
      console.log('Alert settings:', this.alertSettings);
      
      this.getItems();
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

.input-group button[type="submit"] {
  padding: 10px 15px;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.input-group button[type="submit"]:hover {
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

  .input-group button[type="submit"] {
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
}

.end-session-button:hover {
  background-color: #d32f2f;
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

.end-session-modal-button:hover {
  background-color: #d32f2f;
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
</style>