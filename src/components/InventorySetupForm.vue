<template>
  <h1>Interactive Inventory</h1>
  <form @submit.prevent="startInventorySession">
    <div class="section-container">
      <h2>Parameters</h2>
      <div>
        <label for="inventoryDate">Set inventory date to:</label>
        <input type="date" id="inventoryDate" v-model="inventoryDate" />
      </div>
      <div>
        <label for="compareBarcodes">Compare expected barcodes list to scanned barcodes:</label>
        <input type="checkbox" id="compareBarcodes" v-model="compareBarcodes" />
      </div>
      <div>
        <label for="doNotCheckIn">Do not check in items scanned during inventory:</label>
        <input type="checkbox" id="doNotCheckIn" v-model="doNotCheckIn" />
      </div>
      <div>
        <label for="checkShelvedOutOfOrder">Check barcodes list for items shelved out of order:</label>
        <input type="checkbox" id="checkShelvedOutOfOrder" v-model="checkShelvedOutOfOrder" />
      </div>
    </div>
    <div class="section-container">
      <h2>Item Location Filters</h2>
      <div class="form-group">
        <label for="library">Library</label>
        <select v-model="selectedLibraryId" id="library" class="form-control" :disabled="librariesLoading">
          <option value="">All Libraries</option>
          <option v-if="librariesLoading" value="loading" disabled>Loading libraries...</option>
          <option v-for="library in libraries" :key="library.library_id" :value="library.library_id">
            {{ library.name }}
          </option>
        </select>
        <div v-if="librariesLoading" class="loading-indicator">Loading libraries...</div>
      </div>
      <div class="form-group">
        <label for="shelvingLocation">Shelving Location</label>
        <select v-model="shelvingLocation" id="shelvingLocation" class="form-control"
          :disabled="shelvingLocationsLoading">
          <option value="" disabled>Select a shelving location</option>
          <option v-if="shelvingLocationsLoading && Object.keys(shelvingLocations).length <= 1" value="loading"
            disabled>
            Loading shelving locations...
          </option>
          <option v-for="(description, code) in shelvingLocations" :key="code" :value="code" v-if="code !== 'loading'">
            {{ description }}
          </option>
        </select>
        <div v-if="shelvingLocationsLoading" class="loading-indicator">Loading shelving locations...</div>
      </div>
      <div class="form-group">
        <label for="collectionCode">Collection Code</label>
        <select v-model="ccode" id="collectionCode" class="form-control" :disabled="collectionCodesLoading">
          <option value="" disabled>Select a collection code</option>
          <option v-if="collectionCodesLoading && Object.keys(collectionCodes).length <= 1" value="loading" disabled>
            Loading collection codes...
          </option>
          <option v-for="(description, code) in collectionCodes" :key="code" :value="code" v-if="code !== 'loading'">
            {{ description }}
          </option>
        </select>
        <div v-if="collectionCodesLoading" class="loading-indicator">Loading collection codes...</div>
      </div>
      <div>
        <label for="minlocation">Item call number between:</label>
        <input type="text" id="minlocation" v-model="minLocation" class="call-number-input" /> (items.itemcallnumber)
      </div>
      <div>
        <label for="maxlocation">...and:</label>
        <input type="text" id="maxlocation" v-model="maxLocation" class="call-number-input" />
      </div>
      <div>
        <label for="class_source">Call number classification scheme:</label>
        <select id="class_source" v-model="classSource">
          <option v-for="(source, key) in classSources" :key="key" :value="key">{{ source.description }}</option>
        </select>
      </div>
    </div>
    <div class="section-container">
      <fieldset id="optionalfilters">
        <legend>Optional filters for inventory list or comparing barcodes</legend>
        <div class="form-group">
          <span class="hint">Scanned items are expected to match one of the selected "not for loan" criteria if any are
            checked.</span>
          <br />
          <div id="statuses" class="statuses-grid">
            <div v-for="(statusList, statusKey) in statuses" :key="statusKey" class="status-column">
              <label :for="statusKey">{{ statusKey }}:</label>
              <div v-for="status in statusList" :key="statusKey + '-' + status.authorised_value_id" class="status-row">
                <input type="checkbox" :id="statusKey + '-' + status.authorised_value_id"
                  :value="status.authorised_value_id" v-model="selectedStatuses[statusKey]" />
                <label :for="statusKey + '-' + status.authorised_value_id">{{ status.description }}</label>
              </div>
            </div>
          </div>
        </div>
      </fieldset>
      <ul class="no-numbering">
        <li>
          <label for="datelastseen">Last inventory date:</label>
          <input type="date" id="datelastseen" v-model="dateLastSeen" class="flatpickr" />
          (Skip records marked as seen on or after this date.)
        </li>
        <li>
          <label for="ignoreLostStatus">Skip automatically fixing scanned lost items </label>
          <input type="checkbox" id="ignoreLostStatus" v-model="ignoreLostStatus" />
        </li>
        <li>
          <label for="ignore_waiting_holds">Skip items on hold awaiting pickup: </label>
          <input type="checkbox" id="ignoreWaitingHolds" v-model="ignoreWaitingHolds" />
        </li>
        <li>
          <label for="skipCheckedOutItems">Skip/filter checked out items: </label>
          <input type="checkbox" id="skipCheckedOutItems" v-model="skipCheckedOutItems" />
          <span class="help-text">(Items that are currently checked out will not appear in the inventory list)</span>
        </li>
        <li>
          <label for="skipInTransitItems">Skip/filter in-transit items: </label>
          <input type="checkbox" id="skipInTransitItems" v-model="skipInTransitItems" />
          <span class="help-text">(Items that are currently in transit will not appear in the inventory list)</span>
        </li>
      </ul>
      <div class="form-group">
        <label>Item Types</label>
        <div v-if="itemTypesLoading" class="loading-indicator">Loading item types...</div>
        <div class="item-types-grid">
          <div v-for="iType in iTypes" :key="iType.item_type_id" class="item-type-box"
            @click="toggleItype(iType.item_type_id)" :class="{ 'loading': iType.item_type_id === 'loading' }">
            <input type="checkbox" :id="'iType_' + iType.item_type_id" :value="iType.item_type_id"
              v-model="selectedItypes" @click.stop" :disabled="iType.item_type_id === 'loading'" />
            <label :for="'iType_' + iType.item_type_id">{{ iType.description }}</label>
          </div>
        </div>
      </div>
    </div>
    <button type="submit">Submit</button>
  </form>
</template>

<script>
import { EventBus } from './eventBus';
import { apiService } from '../services/apiService';
import { sessionStorage } from '../services/sessionStorage';

export default {
  props: {
    fetchAuthorizedValues: {
      type: Function,
      required: true
    },
  },
  emits: ['start-session'],
  data() {
    const classSources = window.class_sources || {};
    const defaultClassSource = Object.keys(classSources).find(key => classSources[key].default === 1) || '';
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
      compareBarcodes: null,
      doNotCheckIn: false,
      checkShelvedOutOfOrder: false,
      ignoreLostStatus: false,
      skipCheckedOutItems: true,
      skipInTransitItems: false,
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
    };
  },
  created() {
    // We don't need to load anything in the setup form if it won't be shown
    // (Don't call loadFormData here - it will be called by the parent if needed)
  },
  methods: {
    // New method to load all form data
    loadFormData() {
      console.log('Loading form data for setup form');
      this.createStatuses();
      this.fetchLibraries();
      this.fetchCollectionCodes();
      this.fetchItemTypes();
      this.fetchShelvingLocations();
    },

    checkForm() {
      if (!(this.branchLoop || this.locationLoop || this.ccode || this.minLocation || this.maxLocation || this.classSource || this.selectedStatuses.length)) {
        return confirm(
          "You have not selected any catalog filters and are about to compare a file of barcodes to your entire catalog.\n\n" +
          "For large catalogs this can result in unexpected behavior\n\n" +
          "Are you sure you want to do this?"
        );
      }
      return true;
    },

    startInventorySession() {
      // Validate shelving location filter
      if (this.shelvingLocation) {
        // Check if the shelving location is valid (exists in the loaded locations)
        if (!this.shelvingLocations[this.shelvingLocation]) {
          EventBus.emit('message', { 
            type: 'error', 
            text: `Invalid shelving location: ${this.shelvingLocation}. Please select a valid shelving location.` 
          });
          return; // Prevent session from starting
        }

        EventBus.emit('message', { 
          type: 'status', 
          text: `Applying shelving location filter: ${this.shelvingLocations[this.shelvingLocation] || this.shelvingLocation}` 
        });
      }

      // Display status for checked out items filter
      if (this.skipCheckedOutItems) {
        EventBus.emit('message', { 
          type: 'status', 
          text: 'Checked out items will be filtered out from inventory' 
        });
      }
      
      // Display status for in-transit items filter
      if (this.skipInTransitItems) {
        EventBus.emit('message', { 
          type: 'status', 
          text: 'In-transit items will be filtered out from inventory' 
        });
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
        ignoreLostStatus: this.ignoreLostStatus,
        shelvingLocation: this.shelvingLocation,
        skipCheckedOutItems: this.skipCheckedOutItems,
        skipInTransitItems: this.skipInTransitItems,
      });
    },

    async createStatuses() {
      try {
        const statusFields = {
          'items.itemlost': 'LOST',
          'items.notforloan': 'NOT_LOAN',
          'items.withdrawn': 'WITHDRAWN',
          'items.damaged': 'DAMAGED'
        };

        // Initialize statuses with loading placeholders
        Object.keys(statusFields).forEach(key => {
          this.statuses[key] = [{
            authorised_value_id: 'loading',
            description: 'Loading values...'
          }];
        });

        // Load each category of status fields
        for (const [key, field] of Object.entries(statusFields)) {
          try {
            // Update UI handler - Will be called for each page of results
            const onValuesUpdate = (values) => {
              // Force Vue to recognize the change with a new array
              this.statuses[key] = Object.keys(values).map(k => ({
                authorised_value_id: k,
                description: values[k]
              }));
            };

            // Call the API
            await this.fetchAuthorizedValues(field, {
              onValuesUpdate // Pass the handler
            });

          } catch (error) {
            console.error(`Error loading ${key} values:`, error);
            EventBus.emit('message', {
              type: 'error',
              text: `Error loading ${key} values: ${error.message}`
            });
          }
        }
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: `Error creating statuses: ${error.message}` });
      }
    },

    async fetchLibraries() {
      try {
        this.librariesLoading = true;
        this.libraries = [{ library_id: 'loading', name: 'Loading libraries...' }];

        // Use incremental loading
        await apiService.fetchAllPaginated('/api/v1/public/libraries', {
          artificialDelay: 300, // Add some delay to make the loading visible
          onPageFetched: (items, pageNum) => {
            console.log(`Received page ${pageNum} of libraries with ${items.length} items`);

            // Replace the loading placeholder with actual data on first page
            if (pageNum === 1) {
              this.libraries = items;
            } else {
              // Add new items for subsequent pages
              this.libraries = [...this.libraries, ...items];
            }

            // Show status message
            EventBus.emit('message', {
              type: 'status',
              text: `Loaded ${this.libraries.length} libraries...`
            });
          }
        });

        this.librariesLoading = false;
      } catch (error) {
        this.librariesLoading = false;
        EventBus.emit('message', { type: 'error', text: `Error fetching libraries: ${error.message}` });
      }
    },

    async fetchItemTypes() {
      try {
        this.itemTypesLoading = true;
        this.iTypes = [{ item_type_id: 'loading', description: 'Loading item types...' }];

        // Use incremental loading
        await apiService.fetchAllPaginated('/api/v1/item_types', {
          artificialDelay: 300,
          onPageFetched: (items, pageNum) => {
            console.log(`Received page ${pageNum} of item types with ${items.length} items`);

            // Replace the loading placeholder with actual data on first page
            if (pageNum === 1) {
              this.iTypes = items;
            } else {
              // Add new items for subsequent pages
              this.iTypes = [...this.iTypes, ...items];
            }

            // Show status message
            EventBus.emit('message', {
              type: 'status',
              text: `Loaded ${this.iTypes.length} item types...`
            });
          }
        });

        this.itemTypesLoading = false;
      } catch (error) {
        this.itemTypesLoading = false;
        EventBus.emit('message', { type: 'error', text: `Error fetching item types: ${error.message}` });
      }
    },

    async fetchCollectionCodes() {
      try {
        this.collectionCodesLoading = true;
        this.collectionCodes = { loading: 'Loading collection codes...' };

        await this.fetchAuthorizedValues('CCODE', {
          onValuesUpdate: (values) => {
            // Make a clean copy of the values object that Vue can track
            this.collectionCodes = { ...values };

            // Remove loading placeholder when real data arrives
            if (Object.keys(this.collectionCodes).length > 0 && this.collectionCodes.loading) {
              delete this.collectionCodes.loading;
            }
          }
        });

        this.collectionCodesLoading = false;
      } catch (error) {
        this.collectionCodesLoading = false;
        EventBus.emit('message', { type: 'error', text: `Error fetching collection codes: ${error.message}` });
      }
    },

    async fetchShelvingLocations() {
      try {
        this.shelvingLocationsLoading = true;
        this.shelvingLocations = { loading: 'Loading shelving locations...' };

        await this.fetchAuthorizedValues('LOC', {
          onValuesUpdate: (values) => {
            // Make a clean copy of the values object that Vue can track
            this.shelvingLocations = { ...values };

            // Remove loading placeholder when real data arrives
            if (Object.keys(this.shelvingLocations).length > 0 && this.shelvingLocations.loading) {
              delete this.shelvingLocations.loading;
            }
          }
        });

        this.shelvingLocationsLoading = false;
      } catch (error) {
        this.shelvingLocationsLoading = false;
        EventBus.emit('message', { type: 'error', text: `Error fetching shelving locations: ${error.message}` });
      }
    },

    toggleItype(itemTypeId) {
      const index = this.selectedItypes.indexOf(itemTypeId);
      if (index > -1) {
        this.selectedItypes.splice(index, 1);
      } else {
        this.selectedItypes.push(itemTypeId);
      }
    },
  },
};
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

.status-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.status-row label {
  font-weight: normal;
  /* Ensure labels are not bold */
}

.form-group {
  margin-bottom: 1rem;
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
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
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

.item-type-box {
  border: 1px solid #ccc;
  padding: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.item-type-box input {
  margin-right: 10px;
}

.item-type-box:hover {
  background-color: #f0f0f0;
}

.item-type-box.loading {
  opacity: 0.6;
  cursor: default;
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