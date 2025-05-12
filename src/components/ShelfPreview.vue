<template>
  <div class="shelf-preview-container" v-if="show">
    <div class="shelf-preview-header">
      <h3>Upcoming Items Preview</h3>
      <button class="close-button" @click="$emit('close')">&times;</button>
    </div>
    
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading upcoming items...</p>
    </div>
    
    <div v-else-if="upcomingItems.length === 0" class="empty-state">
      <p>No upcoming items found based on current location.</p>
      <p v-if="!lastScannedItem">Scan an item to see upcoming items on the shelf.</p>
    </div>
    
    <div v-else class="shelf-content">
      <div class="current-location-info">
        <div class="info-box">
          <div class="info-label">Current Call Number</div>
          <div class="info-value">{{ lastScannedItem ? lastScannedItem.itemcallnumber || 'N/A' : 'N/A' }}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Shelving Location</div>
          <div class="info-value">{{ lastScannedItem ? getAuthorizedValueDesc(lastScannedItem.location) : 'N/A' }}</div>
        </div>
      </div>
      
      <div class="items-grid">
        <div 
          v-for="(item, index) in visibleItems" 
          :key="item.biblionumber + '-' + item.itemnumber" 
          class="item-card"
          :class="{ 'next-expected': index === 0 }"
        >
          <div class="item-card-header">
            <span class="call-number">{{ item.itemcallnumber }}</span>
            <span v-if="index === 0" class="next-label">NEXT</span>
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
        <button 
          @click="prevPage" 
          :disabled="currentPage === 1" 
          class="nav-button"
        >
          Previous
        </button>
        <span class="pagination-info">{{ currentPage }} of {{ totalPages }}</span>
        <button 
          @click="nextPage" 
          :disabled="currentPage === totalPages" 
          class="nav-button"
        >
          Next
        </button>
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
      currentPage: 1,
      itemsPerPage: 6,
      fetchError: null
    };
  },
  computed: {
    visibleItems() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.upcomingItems.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.upcomingItems.length / this.itemsPerPage) || 1;
    }
  },
  watch: {
    show(newVal) {
      if (newVal && this.lastScannedItem) {
        this.fetchUpcomingItems();
      }
    },
    lastScannedItem(newVal) {
      if (newVal && this.show) {
        this.fetchUpcomingItems();
      }
    }
  },
  methods: {
    async fetchUpcomingItems() {
      if (!this.lastScannedItem || !this.lastScannedItem.itemcallnumber) {
        this.upcomingItems = [];
        return;
      }
      
      this.loading = true;
      this.fetchError = null;
      
      try {
        // Get parameters for the API call
        const callNumber = this.lastScannedItem.itemcallnumber;
        const location = this.lastScannedItem.location || '';
        const library = this.sessionData?.selectedLibraryId || this.lastScannedItem.homebranch || '';
        
        // Fetch next items in the call number sequence for this location and library
        const response = await apiService.get(
          `/api/v1/contrib/interactiveinventory/items/next-in-sequence`,
          {
            call_number: callNumber,
            location: location,
            library: library,
            limit: 30,
            include_issues: true
          }
        );
        
        if (response && response.items) {
          // Process items - mark those with issues
          this.upcomingItems = response.items.map(item => {
            // Add a flag to indicate if the item has any issues
            const hasIssues = 
              item.checked_out || 
              item.missing || 
              item.in_transit || 
              item.on_hold;
              
            return {
              ...item,
              issues: hasIssues
            };
          });
          
          // Reset to first page when getting new items
          this.currentPage = 1;
          
          // Emit event with the count of upcoming items
          this.$emit('items-loaded', this.upcomingItems.length);
        } else {
          this.upcomingItems = [];
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error fetching upcoming items:', error);
        this.fetchError = error.message || 'Failed to fetch upcoming items';
        EventBus.emit('message', {
          type: 'error',
          text: `Error loading upcoming items: ${this.fetchError}`
        });
        this.upcomingItems = [];
      } finally {
        this.loading = false;
      }
    },
    
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },
    
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },
    
    getAuthorizedValueDesc(code) {
      if (!code) return 'N/A';
      
      // Look for the code in the LOC authorized value category
      if (this.authorizedValueCategories && 
          this.authorizedValueCategories.LOC && 
          this.authorizedValueCategories.LOC[code]) {
        return this.authorizedValueCategories.LOC[code];
      }
      
      return code;
    }
  }
};
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
  z-index: 900;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow: hidden;
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

.loading-state, .empty-state {
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.item-card {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.item-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
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

.pagination-info {
  font-size: 0.9rem;
  color: #666;
}

@media (max-width: 768px) {
  .shelf-preview-container {
    width: 95%;
    max-height: 70vh;
  }
  
  .items-grid {
    grid-template-columns: 1fr;
  }
  
  .current-location-info {
    flex-direction: column;
    gap: 10px;
  }
}
</style> 