<template>
  <div class="container">
    <InventorySetupForm 
      @start-session="initiateInventorySession" 
      :fetchAuthorizedValues="fetchAuthorizedValues"
      v-if="!sessionStarted" />
    <div v-else>
      <form @submit.prevent="submitBarcode" class="barcode-form">
        <label for="barcode_input">Scan Barcode:</label>
        <input type="text" v-model="barcode" id="barcode_input" ref="barcodeInput" />
        <button type="submit">Submit</button>
      </form>
      <div id="inventory_results" class="items-list">
        <InventoryItem
          v-for="(item, index) in items"
          :key="`${index}-${item.id}`"
          :item="item"
          :index="index"
          :isExpanded="item.isExpanded"
          @toggleExpand="handleToggleExpand"
          :fetchAuthorizedValues="fetchAuthorizedValues"
          :sessionData="sessionData"
          :currentItemWithHighestCallNumber="itemWithHighestCallNumber"
          :currentBiblioWithHighestCallNumber="biblioWithHighestCallNumber"
        />  
      </div>
    </div>
  <button v-if="sessionStarted" @click="showEndSessionModal = true" class="end-session-button">End Session</button>

    <!-- End Session Modal -->
    <div v-if="showEndSessionModal" class="modal">
      <div class="modal-content">
        <span @click="showEndSessionModal = false" class="close">&times;</span>
        <h2>End Session</h2>
        <p v-if="uniqueBarcodesCount <= expectedUniqueBarcodes">Scanned {{ uniqueBarcodesCount }} unique barcodes of an expected {{ expectedUniqueBarcodes }} are you sure you want to end the session?</p>
        <div class="modal-checkboxes">
          <input type="checkbox" id="exportToCSV" v-model="exportToCSV"> Export to CSV
        </div>
        <div class="modal-checkboxes">
          <input type="checkbox" v-model="markMissingItems" id="mark-missing-items"> Mark "loststatus" as missing for any expected items not scanned
        </div>
        <span v-if="markMissingItems" style="color: red;">(This can take a while for large numbers of missing items)</span>
        <button @click="endSession" class="end-session-modal-button">End Session</button>
      </div>
    </div>
  </div>
  
</template>

<script>
import InventorySetupForm from './InventorySetupForm.vue'
import InventoryItem from './InventoryItem.vue'
import { EventBus } from './eventBus'

export default {
  components: {
    InventorySetupForm,
    InventoryItem
  },
  computed: {
    uniqueBarcodesCount() {
        const uniqueBarcodes = new Set(this.items.map(item => item.external_id));
        return uniqueBarcodes.size;
      },
    expectedUniqueBarcodes() {
      return this.sessionData && this.sessionData.response_data ? (this.sessionData.response_data.total_records || 0) : 0;
    }
  },
  data() {
    return {
      barcode: '',
      items: [],
      sessionData: null,
      sessionStarted: false,
      highestCallNumberSort: '',
      itemWithHighestCallNumber: '',
      biblioWithHighestCallNumber: '',
      showEndSessionModal: false,
      exportToCSV: false,
      markMissingItems: false,
    };
  },
  methods: {
    async endSession() {
    if (this.exportToCSV) {
      // Logic to export data to CSV
      await this.exportDataToCSV();
    }

    if (this.markMissingItems) {
      // Add defensive check for location_data
      const locationData = this.sessionData.response_data.location_data || [];
      const scannedBarcodesSet = new Set(this.items.map(item => item.external_id));
      const missingItems = locationData.filter(item => !scannedBarcodesSet.has(item.barcode));
      // Mark missing items
      const itemsToUpdate = missingItems.map(item => ({
        barcode: item.barcode,
        fields: { itemlost: 4 }
      }));

      if (itemsToUpdate.length > 0) {
        await this.updateItemStatus(itemsToUpdate);
      }
    }

    // Logic to end the session
    this.showEndSessionModal = false;
    // Additional session ending logic
    },
    async fetchAuthorizedValues(category) {
      const response = await fetch(`/api/v1/authorised_value_categories/${category}/authorised_values`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch authorized values for ${category}`);
      }
      const data = await response.json();
      return data;
    },
    
    async submitBarcode() {
      try {
        // Fetch item data
        const itemResponse = await fetch(
          `/api/v1/items?external_id=${encodeURIComponent(this.barcode)}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        if (!itemResponse.ok) {
          throw new Error('Network response was not ok');
        }
        const itemText = await itemResponse.text();
        const itemsArray = itemText ? JSON.parse(itemText) : [];
        const itemData = itemsArray[0] || {};

        // Fetch biblio data using biblio_id from item data
        const biblioResponse = await fetch(
          `/api/v1/biblios/${itemData.biblio_id}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        if (!biblioResponse.ok) {
          throw new Error('Network response was not ok');
        }
        const biblioText = await biblioResponse.text();
        const biblioData = biblioText ? JSON.parse(biblioText) : {};
        window.biblioData = biblioData;

        // Combine item data and biblio data
        const combinedData = { ...itemData, biblio: biblioData };

        // Add running 'fields to amend' variable
        var fieldsToAmend = {};

        if (this.sessionData.inventoryDate > combinedData.last_seen_date)
          fieldsToAmend["datelastseen"] = this.sessionData.inventoryDate;

        // If set to compare barcodes, check if the scanned barcode is in the expected list.
        // If not, show an alert and return.
        // Add defensive check before accessing right_place_list
        const rightPlaceList = this.sessionData.response_data.right_place_list || [];
        const isInRightPlaceList = rightPlaceList.some(item => item.barcode === combinedData.external_id);
        if (this.sessionData.compareBarcodes && !isInRightPlaceList) {
          combinedData.wrongPlace = true; // Flag the item as in the wrong place
        }

        if (combinedData.checked_out_date && !this.sessionData.doNotCheckIn){
          await this.checkInItem(combinedData.external_id);
        }

        // Check if the item is marked as lost and update its status
        if (combinedData.lost_status != "0") {
          combinedData.wasLost = true; // Flag the item as previously lost
          //add the key-value pair to the fields to amend object
          if (!this.sessionData.ignoreLostStatus){
            fieldsToAmend["itemlost"] = '0';
          }
        }

        if (this.sessionData.checkShelvedOutOfOrder && combinedData.call_number_sort < this.highestCallNumberSort){
          combinedData.outOfOrder = 1;
        } else {
          this.highestCallNumberSort = combinedData.call_number_sort;
          this.itemWithHighestCallNumber = combinedData.external_id;
          this.biblioWithHighestCallNumber = combinedData.biblio_id;
        }

        if (this.sessionData.selectedStatuses && Object.values(this.sessionData.selectedStatuses).some(statusArray => statusArray.length > 0)){
          this.checkItemStatuses(combinedData, this.sessionData.selectedStatuses);
        }

        combinedData.wasScanned = true;
        window.combinedData = combinedData;

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

        // Clear the barcode input and focus on it
        this.barcode = '';
        this.$refs.barcodeInput.focus();
      } catch (error) {
        console.error(error);
        EventBus.emit('message', { text: `Error scanning barcode: ${error.message}`, type: 'error' });
      }
    },
    async checkInItem(barcode) {
      try {
        const response = await fetch(
          `/api/v1/contrib/interactiveinventory/item/checkin`, 
          {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            barcode: barcode,
            date: this.sessionData.inventoryDate
          })
        });
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        EventBus.emit('message', { text: 'Item checked in successfully', type: 'status' });
      } catch (error) {
        EventBus.emit('message', { text: `Error checking in item: ${error.message}`, type: 'error' });
      }
    },
  async updateItemStatus(items = []) {
    try {
      console.log('Updating multiple item statuses:', items);
      const response = await fetch(
        `/api/v1/contrib/interactiveinventory/item/fields`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            items: items
          })
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(`Network response was not ok: ${errorData?.errors?.[0]?.message || response.statusText}`);
      }
      const data = await response.json();
      EventBus.emit('message', { text: 'Item statuses updated successfully', type: 'status' });
    } catch (error) {
      EventBus.emit('message', { text: `Error updating item statuses: ${error.message}`, type: 'error' });
    }
  },
    async updateSingleItemStatus(barcode, fields) {
      try {
        console.log('Updating single item status:', barcode, fields);
        const response = await fetch(
          `/api/v1/contrib/interactiveinventory/item/field`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              barcode: barcode,
              fields: fields
            })
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          throw new Error(`Network response was not ok: ${errorData?.error || response.statusText}`);
        }
        
        const data = await response.json();
        EventBus.emit('message', { text: 'Item status updated successfully', type: 'status' });
      } catch (error) {
        EventBus.emit('message', { text: `Error updating item status: ${error.message}`, type: 'error' });
      }
    },
    async initiateInventorySession(sessionData) {
      this.sessionData = sessionData;
      this.sessionStarted = true;
      try {
        const response = await fetch(
          `/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=start_session&session_data=${encodeURIComponent(JSON.stringify(sessionData))}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        this.sessionData.response_data = data; // Add this line to include the response data in sessionData

      } catch (error) {
        EventBus.emit('message', { text: `Error starting inventory session ${error.message}`, type: 'error' });
      }
    },
    handleToggleExpand(itemId) {
      this.items = this.items.map((item, index) => ({
        ...item,
        isExpanded: `${index}-${item.id}` === itemId ? !item.isExpanded : false // Toggle the clicked item, collapse others
      }));
    },
    fetchAuthorizedValues(field) {
      return fetch(`/api/v1/authorised_value_categories/${field}/authorised_values`)
        .then(response => response.json())
        .then(data => {
          const values = {};
          data.forEach(item => {
            values[item.value] = item.description;
          });
          return values;
        })
        .catch(error => {
          EventBus.emit('message', { type: 'error', text: `Error fetching authorized values: ${error.message}` });
          throw error;
        });
    },
    exportDataToCSV() {
      const headers = [
        'Barcode','Item ID', 'Biblio ID', 'Title', 'Author', 'Publication Year', 'Publisher', 'ISBN', 'Pages', 'Location', 'Acquisition Date', 'Last Seen Date', 'URL', 'Was Lost', 'Wrong Place', 'Was Checked Out', 'Scanned Out of Order', 'Had Invalid "Not for loan" Status','Scanned'
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
  }
  }
}
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.barcode-form {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.barcode-form label {
  margin-bottom: 5px;
  font-weight: bold;
}

.barcode-form input {
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.barcode-form button {
  padding: 10px 20px;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.barcode-form button:hover {
  background-color: #0056b3;
}

.items-list {
  margin-top: 20px;
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
  z-index: 1000; /* Ensure it stays above other content */
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
  z-index: 1000;
}

.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 500px;
  max-width: 90%;
}

.close {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 24px;
  cursor: pointer;
}

h2 {
  margin-top: 0;
}

label {
  display: block;
  margin: 20px 0;
  font-size: 16px;
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

.modal-checkboxes {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.modal-checkboxes input[type="checkbox"] {
  margin-right: 10px;
}

.modal-checkboxes label {
  flex: 1;
  word-wrap: break-word;
}

</style>