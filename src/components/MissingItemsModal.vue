<template>
  <div v-if="show" class="missing-items-modal-overlay">
    <div class="missing-items-modal">
      <div class="missing-items-modal-header">
        <h2>Missing Items</h2>
        <button class="close-button" @click="close">&times;</button>
      </div>
      
      <div class="missing-items-modal-body">
        <div v-if="loading" class="loading-indicator">
          <div class="spinner"></div>
          <p>Processing...</p>
        </div>
        
        <div v-else>
          <div class="missing-items-stats">
            <div class="stat-box">
              <div class="stat-number">{{ missingItems.length }}</div>
              <div class="stat-label">Missing Items</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{{ totalExpectedItems }}</div>
              <div class="stat-label">Expected Items</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{{ Math.round((missingItems.length / totalExpectedItems) * 100) || 0 }}%</div>
              <div class="stat-label">Missing Rate</div>
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
                <input type="checkbox" id="selectAll" v-model="selectAll" @change="toggleSelectAll" />
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
                Mark as Missing
              </button>
            </div>
          </div>
          
          <div v-if="filteredItems.length === 0" class="no-missing-items">
            <p v-if="searchQuery">No missing items match your search criteria.</p>
            <p v-else>No missing items found.</p>
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
                <tr v-for="item in filteredItems" :key="item.barcode" :class="{'selected-row': selectedItemsSet.has(item.barcode)}">
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
                    <button class="action-button" @click="markItemAsMissing(item)">Mark Missing</button>
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
                  <div class="detail-value">{{ formatDate(selectedItemDetail.datelastseen) || 'Never' }}</div>
                </div>
              </div>
              <div class="detail-actions">
                <button class="action-button primary" @click="markItemAsMissing(selectedItemDetail)">Mark as Missing</button>
                <a :href="`/cgi-bin/koha/catalogue/detail.pl?biblionumber=${selectedItemDetail.biblionumber}`" 
                   target="_blank" class="action-button">View in Catalog</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { EventBus } from './eventBus';
import { apiService } from '../services/apiService';

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
    scannedItems: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      loading: false,
      missingItems: [],
      selectedItems: [],
      selectedItemsSet: new Set(),
      searchQuery: '',
      sortBy: 'title',
      selectAll: false,
      currentPage: 1,
      itemsPerPage: 20,
      showDetailModal: false,
      selectedItemDetail: null
    };
  },
  computed: {
    totalExpectedItems() {
      if (!this.sessionData || !this.sessionData.response_data) return 0;
      return this.sessionData.response_data.total_records || 0;
    },
    filteredItems() {
      if (!this.missingItems.length) return [];
      
      let filtered = [...this.missingItems];
      
      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          (item.title && item.title.toLowerCase().includes(query)) ||
          (item.author && item.author.toLowerCase().includes(query)) ||
          (item.barcode && item.barcode.toLowerCase().includes(query)) ||
          (item.itemcallnumber && item.itemcallnumber.toLowerCase().includes(query))
        );
      }
      
      // Apply sorting
      if (this.sortBy) {
        filtered.sort((a, b) => {
          const valueA = (a[this.getSortField()] || '').toLowerCase();
          const valueB = (b[this.getSortField()] || '').toLowerCase();
          return valueA.localeCompare(valueB);
        });
      }
      
      // Apply pagination
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      
      return filtered.slice(startIndex, endIndex);
    },
    totalPages() {
      if (!this.missingItems.length) return 1;
      return Math.ceil(this.missingItems.length / this.itemsPerPage);
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.initialize();
      }
    },
    selectedItems: {
      handler(newVal) {
        // Update the Set for faster lookups
        this.selectedItemsSet = new Set(newVal);
      },
      deep: true
    }
  },
  methods: {
    initialize() {
      this.loading = true;
      this.calculateMissingItems();
      this.loading = false;
    },
    
    calculateMissingItems() {
      if (!this.sessionData || !this.sessionData.response_data) {
        this.missingItems = [];
        return;
      }
      
      // Get the location data from session response
      const locationData = this.sessionData.response_data.location_data || [];
      
      // Get a set of scanned barcodes for quick lookup
      const scannedBarcodesSet = new Set(this.scannedItems.map(item => item.external_id));
      
      // Filter out items that are checked out, in transit, etc. based on session settings
      this.missingItems = locationData.filter(item => {
        // Skip items that have already been scanned
        if (scannedBarcodesSet.has(item.barcode)) {
          return false;
        }
        
        // Skip items that are checked out if the session is configured to do so
        if (this.sessionData.skipCheckedOutItems && item.checked_out) {
          return false;
        }
        
        // Skip items that are in transit if the session is configured to do so
        if (this.sessionData.skipInTransitItems && item.in_transit) {
          return false;
        }
        
        // Skip items that have branch mismatch if the session is configured to do so
        if (this.sessionData.skipBranchMismatchItems && item.homebranch !== item.holdingbranch) {
          return false;
        }
        
        return true;
      });
      
      // Reset pagination when loading new data
      this.currentPage = 1;
      this.selectedItems = [];
      this.selectAll = false;
    },
    
    getSortField() {
      switch(this.sortBy) {
        case 'author': return 'author';
        case 'callNumber': return 'itemcallnumber';
        case 'barcode': return 'barcode';
        case 'title':
        default: return 'title';
      }
    },
    
    applyFilters() {
      // Reset pagination when filters change
      this.currentPage = 1;
    },
    
    close() {
      this.$emit('close');
    },
    
    toggleSelectAll() {
      if (this.selectAll) {
        this.selectedItems = this.missingItems.map(item => item.barcode);
      } else {
        this.selectedItems = [];
      }
    },
    
    updateSelectAllState() {
      // Update the "select all" checkbox based on current selections
      this.selectAll = this.selectedItems.length === this.missingItems.length && this.missingItems.length > 0;
    },
    
    async markItemAsMissing(item) {
      try {
        this.loading = true;
        
        // Call API to mark item as missing
        const result = await apiService.post(
          `/api/v1/contrib/interactiveinventory/item/field`,
          { 
            barcode: item.barcode, 
            fields: { itemlost: 4 } // 4 is the code for "Missing"
          }
        );
        
        if (result && result.success) {
          EventBus.emit('message', {
            type: 'success',
            text: `Item "${item.title || item.barcode}" has been marked as missing.`
          });
          
          // Remove item from the list if it was successfully marked
          this.missingItems = this.missingItems.filter(i => i.barcode !== item.barcode);
          this.selectedItems = this.selectedItems.filter(barcode => barcode !== item.barcode);
          
          // Close detail modal if open
          if (this.showDetailModal && this.selectedItemDetail && this.selectedItemDetail.barcode === item.barcode) {
            this.showDetailModal = false;
          }
          
          // Emit event to update parent component
          this.$emit('item-marked-missing', item.barcode);
        } else {
          throw new Error(result.error || 'Unknown error occurred');
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to mark item as missing: ${error.message}`
        });
      } finally {
        this.loading = false;
      }
    },
    
    async markSelectedAsMissing() {
      if (this.selectedItems.length === 0) return;
      
      try {
        this.loading = true;
        
        // Confirm action if many items selected
        if (this.selectedItems.length > 10) {
          const confirmed = confirm(`Are you sure you want to mark ${this.selectedItems.length} items as missing? This action cannot be undone.`);
          if (!confirmed) {
            this.loading = false;
            return;
          }
        }
        
        // Create array of items to update
        const itemsToUpdate = this.selectedItems.map(barcode => ({
          barcode,
          fields: { itemlost: 4 } // 4 is the code for "Missing"
        }));
        
        // Call API to mark items as missing
        const result = await apiService.post(
          `/api/v1/contrib/interactiveinventory/item/fields`,
          { items: itemsToUpdate }
        );
        
        if (result && result.success) {
          EventBus.emit('message', {
            type: 'success',
            text: `${this.selectedItems.length} items have been marked as missing.`
          });
          
          // Remove marked items from the list
          this.missingItems = this.missingItems.filter(item => !this.selectedItems.includes(item.barcode));
          
          // Reset selection
          this.selectedItems = [];
          this.selectAll = false;
          
          // Emit event to update parent component
          this.$emit('items-marked-missing', itemsToUpdate.map(item => item.barcode));
        } else {
          throw new Error(result.error || 'Unknown error occurred');
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to mark items as missing: ${error.message}`
        });
      } finally {
        this.loading = false;
      }
    },
    
    viewItemDetails(item) {
      this.selectedItemDetail = item;
      this.showDetailModal = true;
    },
    
    exportSelectedToCSV() {
      if (this.selectedItems.length === 0) return;
      
      try {
        // Filter items to only include selected ones
        const itemsToExport = this.missingItems.filter(item => 
          this.selectedItems.includes(item.barcode)
        );
        
        // Define headers
        const headers = [
          'Barcode', 'Title', 'Author', 'Call Number', 'Location', 
          'Home Branch', 'Holding Branch', 'Item Type', 'Last Seen'
        ];
        
        // Create CSV content
        const csvContent = [
          headers.join(','),
          ...itemsToExport.map(item => [
            `"${item.barcode || ''}"`,
            `"${(item.title || '').replace(/"/g, '""')}"`,
            `"${(item.author || '').replace(/"/g, '""')}"`,
            `"${(item.itemcallnumber || '').replace(/"/g, '""')}"`,
            `"${(item.location || '').replace(/"/g, '""')}"`,
            `"${item.homebranch || ''}"`,
            `"${item.holdingbranch || ''}"`,
            `"${item.itype || ''}"`,
            `"${item.datelastseen || 'Never'}"`,
          ].join(','))
        ].join('\n');
        
        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'missing_items.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        EventBus.emit('message', {
          type: 'success',
          text: `CSV file with ${itemsToExport.length} missing items has been downloaded.`
        });
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Error exporting to CSV: ${error.message}`
        });
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return '';
      
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
      } catch (e) {
        return dateString;
      }
    }
  }
};
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

.missing-items-stats {
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
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

.export-button, .mark-button {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .missing-items-stats {
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