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
        <select v-model="selectedLibraryId" id="library" class="form-control">
          <option value="">All Libraries</option>
          <option v-for="library in libraries" :key="library.library_id" :value="library.library_id">
            {{ library.name }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="shelvingLocation">Shelving Location</label>
        <select v-model="shelvingLocation" id="shelvingLocation" class="form-control">
          <option value="" disabled>Select a shelving location</option>
          <option v-for="shelvingLocation, key in shelvingLocations" :key="key" :value="key">{{ shelvingLocation }}</option>
        </select>
      </div>
      <div class="form-group">
        <label for="collectionCode">Collection Code</label>
        <select v-model="ccode" id="collectionCode" class="form-control">
          <option value="" disabled>Select a collection code</option>
          <option v-for="ccode, key in collectionCodes" :key="key" :value="key">{{ ccode }}</option>
        </select>
      </div>
      <div>
        <label for="minlocation">Item call number between:</label>
        <input type="text" id="minlocation" v-model="minLocation"  class="call-number-input" /> (items.itemcallnumber)
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
        <span class="hint">Scanned items are expected to match one of the selected "not for loan" criteria if any are checked.</span>
        <br/>
        <div id="statuses" class="statuses-grid">
          <div v-for="(statusList, statusKey) in statuses" :key="statusKey" class="status-column">
            <label :for="statusKey">{{ statusKey }}:</label>
            <div v-for="status in statusList" :key="statusKey + '-' + status.authorised_value_id" class="status-row">
              <input type="checkbox" :id="statusKey + '-' + status.authorised_value_id" :value="status.authorised_value_id" v-model="selectedStatuses[statusKey]" />
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
          <input type="checkbox" id="ignore_waiting_holds" v-model="ignoreWaitingHolds" />
        </li>
      </ul>
      <div class="form-group">
          <label>Item Types</label>
          <div class="item-types-grid">
            <div v-for="iType in iTypes" :key="iType.item_type_id" class="item-type-box" @click="toggleItype(iType.item_type_id)">
              <input type="checkbox" :id="'iType_' + iType.item_type_id" :value="iType.item_type_id" v-model="selectedItypes" @click.stop />
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
      statuses: {},
      libraries: [],
      selectedLibraryId: '',
      collectionCodes: [],
      classSources: window.class_sources, 
      iTypes: [],
      selectedItypes: [],
      inventoryDate: new Date().toISOString().split('T')[0],
      shelvingLocations: [],
      shelvingLocation: '',
    };
  },
  created() {
    this.createStatuses();
    this.fetchLibraries();
    this.fetchCollectionCodes();
    this.fetchItemTypes();
    this.fetchShelvingLocations();
  },
  methods: {
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
        ignoreIssued: this.ignoreIssued,
        ignoreWaitingHolds: this.ignoreWaitingHolds,
        selectedItypes: this.selectedItypes,
        selectedLibraryId: this.selectedLibraryId,
        inventoryDate: this.inventoryDate,
        compareBarcodes: this.compareBarcodes,
        doNotCheckIn: this.doNotCheckIn,
        checkShelvedOutOfOrder: this.checkShelvedOutOfOrder,
        ignoreLostStatus: this.ignoreLostStatus,
        shelvingLocation: this.shelvingLocation,
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

      const statusPromises = Object.values(statusFields).map(field => this.fetchAuthorizedValues(field));
      const statusResults = await Promise.all(statusPromises);

      Object.keys(statusFields).forEach((key, index) => {
        let result = statusResults[index];
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          result = Object.keys(result).map(k => ({
            value: k,
            description: result[k]
          }));
        }

        if (Array.isArray(result)) {
          this.statuses[key] = result.map(item => ({
            authorised_value_id: item.value,
            description: item.description
          }));
        } else {
          EventBus.emit('message', { type: 'error', text: `Unexpected result format for ${statusFields[key]}, ${result}` });
        }
      });
    } catch (error) {
      EventBus.emit('message', { type: 'error', text: `Error creating statuses: ${error.message}` });
    }
  },
  async fetchLibraries() {
      try {
        const response = await fetch('/api/v1/public/libraries?_per_page=-1');
        const data = await response.json();
        this.libraries = data;
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: `Error fetching libraries: ${error.message}` });
      }
    },
    async fetchItemTypes() {
      try {
        const response = await fetch('/api/v1/item_types?_per_page=-1');
        const data = await response.json();
        this.iTypes = data;
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: `Error fetching itemTypes: ${error.message}` });
      }
    },
    async fetchCollectionCodes() {
      try {
        const collectionCodes = await this.fetchAuthorizedValues('CCODE');
        this.collectionCodes = collectionCodes;
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: `Error fetching collection codes: ${error.message}` });
      }
    },
    async fetchShelvingLocations() {
      try {
        const shelvingLocations = await this.fetchAuthorizedValues('LOC');
        this.shelvingLocations = shelvingLocations;
      } catch (error) {
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
  grid-template-columns: repeat(4, 1fr); /* Ensure all columns fit in one row */
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
  font-weight: normal; /* Ensure labels are not bold */
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
  max-width: 200px; /* Set a max-width to prevent stretching */
}
</style>