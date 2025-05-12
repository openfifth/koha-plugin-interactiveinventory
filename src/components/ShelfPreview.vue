<template>
  <div class="shelf-preview-container" v-if="show" :key="renderKey">
    <div class="shelf-preview-header">
      <h3>Upcoming Items Preview</h3>
      <button class="close-button" @click="$emit('close')">&times;</button>
    </div>
    
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading upcoming items...</p>
    </div>
    
    <div v-else-if="upcomingItems.length === 0" class="empty-state">
      <p v-if="lastScannedItem">No items found on the same shelf as the current item.</p>
      <p v-else>Scan an item to see upcoming items on the shelf.</p>
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
      fetchError: null,
      renderKey: 0,
      currentItem: null,
      allItems: []
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
      if (newVal) {
        console.log("ShelfPreview - show changed to true, initializing data");
        this.initializeData();
      }
    },
    lastScannedItem: {
      handler(newVal) {
        if (newVal && this.show) {
          console.log('ShelfPreview - lastScannedItem changed, initializing data with new item');
          // Force clear the current items before fetching new ones
          this.upcomingItems = [];
          this.initializeData();
        }
      },
      deep: true
    }
  },
  methods: {
    getCurrentCallNumber() {
      if (!this.lastScannedItem) return 'N/A';
      
      // Use callnumber directly, which matches the sample item structure
      const callNumber = this.lastScannedItem.callnumber || '';
                     
      console.log('Current call number extracted:', callNumber);
      
      // Also check for call_number_sort which is in the sample data
      const cnSort = this.lastScannedItem.call_number_sort || '';
      
      console.log('Current cn_sort extracted:', cnSort);
      
      return callNumber || cnSort || 'N/A';
    },
    
    getCurrentLocation() {
      if (!this.lastScannedItem) return 'N/A';
      
      const location = this.lastScannedItem.location || '';
      return this.getAuthorizedValueDesc(location);
    },
    
    async fetchUpcomingItems() {
      // If we don't have a current item, show empty state
      if (!this.currentItem) {
        console.log("No current item found, showing empty state");
        this.upcomingItems = [];
        return;
      }

      console.log(`Finding nearby items for: ${this.currentItem.barcode}`);
      console.log(`Library: "${this.currentItem.library}", Location: "${this.currentItem.location}"`);
      console.log(`Call number: "${this.currentItem.call_number}", Call number sort: "${this.currentItem.cn_sort}"`);
      
      // 1. First filter: Only include items with the same location and library
      const sameLocationAndLibrary = this.allItems.filter(item => 
        item.location === this.currentItem.location && 
        item.library === this.currentItem.library && 
        item.barcode !== this.currentItem.barcode
      );
      
      console.log(`Found ${sameLocationAndLibrary.length} items with matching location and library (excluding current item)`);
      
      // 2. Compare call numbers to find items that should be on the same shelf
      const normalizedCurrentCnSort = this.stripCnSort(this.currentItem.cn_sort || '');
      
      // Find items with matching call number class
      const sameShelfItems = sameLocationAndLibrary.filter(item => {
        // Skip items without call numbers
        if (!item.cn_sort) return false;
        
        // Check if this item matches the current item's call number classification
        return this.compareCallNumbers(this.currentItem.cn_sort, item.cn_sort);
      });
      
      console.log(`Found ${sameShelfItems.length} items with matching call number classification`);
      
      // If no matching items on the same shelf, show empty state
      if (sameShelfItems.length === 0) {
        console.log("No matching items found on the same shelf. Showing empty state.");
        this.upcomingItems = [];
        return;
      }
      
      // 3. Add the current item temporarily to sort everything together
      const allShelfItems = [
        ...sameShelfItems,
        {
          ...this.currentItem,
          isCurrentItem: true // Mark as current item
        }
      ];
      
      // 4. Sort all items by call number
      allShelfItems.sort((a, b) => (a.cn_sort || '').localeCompare(b.cn_sort || ''));
      
      // 5. Find the index of the current item after sorting
      const currentItemIndex = allShelfItems.findIndex(item => item.isCurrentItem);
      console.log(`Current item is at position ${currentItemIndex} after sorting`);
      
      // 6. Extract items before and after the current item
      const itemsAfter = currentItemIndex < allShelfItems.length - 1 
        ? allShelfItems.slice(currentItemIndex + 1).slice(0, 15) 
        : [];
        
      const itemsBefore = currentItemIndex > 0 
        ? allShelfItems.slice(Math.max(0, currentItemIndex - 5), currentItemIndex)
        : [];
      
      console.log(`Found ${itemsAfter.length} items after and ${itemsBefore.length} items before the current item`);
      
      // 7. Combine the lists with after items first (they're what the user will see next)
      this.upcomingItems = [...itemsAfter, ...itemsBefore];
      
      console.log(`Showing ${this.upcomingItems.length} items on the shelf`);
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
    },
    
    // Simplify the stripCnSort method to only handle Dewey and LoC formats
    stripCnSort(cnSort) {
      // Convert to lowercase for case-insensitive comparison
      if (!cnSort || cnSort.trim() === '') return '';
      
      const lowerCnSort = cnSort.toLowerCase().trim();
      
      // Case 1: Dewey decimal format (like "641.5" or "641.59" or "641")
      // Extract the main class (first 3 digits before any decimal)
      const deweyMatch = lowerCnSort.match(/^(\d{1,3})(?:\.\d+)?/);
      if (deweyMatch) {
        return deweyMatch[1]; // Just the main class numbers
      }
      
      // Case 2: Library of Congress format (like "QA76.73.J38" or "PR6058.A69 B4")
      // Extract the main class and number part (e.g., "QA76")
      const locMatch = lowerCnSort.match(/^([a-z]+)(\d+)/);
      if (locMatch) {
        return locMatch[1] + locMatch[2]; // e.g., "qa76"
      }
      
      // For everything else, return as is
      return lowerCnSort;
    },
    
    // Simplify the compareCallNumbers method
    compareCallNumbers(cn1, cn2) {
      // Handle edge cases - if either call number is empty
      if (!cn1 || !cn2) {
        return false;
      }
      
      // Get normalized versions
      const normalized1 = this.stripCnSort(cn1);
      const normalized2 = this.stripCnSort(cn2);
      
      // Compare normalized versions
      const match = normalized1 === normalized2;
      
      // Log the comparison for debugging
      console.log(`Comparing: "${cn1}" → "${normalized1}" vs "${cn2}" → "${normalized2}": ${match ? 'MATCH' : 'NO MATCH'}`);
      
      return match;
    },
    
    // Update verification checks to focus on basic Dewey and LoC formats
    verifyMatchLogic() {
      console.log("Verifying call number matching for library formats:");
      
      // Dewey Decimal format checks
      console.log('=== DEWEY DECIMAL CHECKS ===');
      console.log("641.5 vs 641.59: " + this.compareCallNumbers("641.5", "641.59")); // Should match (same main class)
      console.log("641.5 vs 642: " + this.compareCallNumbers("641.5", "642")); // Should NOT match (different class)
      console.log("641 vs 641.5: " + this.compareCallNumbers("641", "641.5")); // Should match (same main class)
      
      // Library of Congress format checks
      console.log('=== LIBRARY OF CONGRESS CHECKS ===');
      console.log("QA76.73.J38 vs QA76.76.C65: " + this.compareCallNumbers("QA76.73.J38", "QA76.76.C65")); // Should match (same class+number)
      console.log("PS3566.L27 vs PS3566.L275: " + this.compareCallNumbers("PS3566.L27", "PS3566.L275")); // Should match (same class+number)
      console.log("QA76.73 vs QB76.73: " + this.compareCallNumbers("QA76.73", "QB76.73")); // Should NOT match (different class)
      
      // Cross-format comparison
      console.log('=== CROSS-FORMAT CHECKS ===');
      console.log("641.5 vs QA76.73: " + this.compareCallNumbers("641.5", "QA76.73")); // Should NOT match (different formats)
    },
    
    // Helper methods to consistently extract biblio data
    getBiblioTitle(item) {
      if (!item.biblio) return 'Unknown Title';
      
      if (item.biblio._custom && item.biblio._custom.value) {
        return item.biblio._custom.value.title || 'Unknown Title';
      }
      
      return item.biblio.title || 'Unknown Title';
    },
    
    getBiblioAuthor(item) {
      if (!item.biblio) return 'Unknown Author';
      
      if (item.biblio._custom && item.biblio._custom.value) {
        return item.biblio._custom.value.author || 'Unknown Author';
      }
      
      return item.biblio.author || 'Unknown Author';
    },
    
    // Update the location code mapping function to use localStorage
    mapLocationCodeToName(locationCode) {
      if (!locationCode) return '';
      
      try {
        // Get authorized values map from localStorage
        const authorizedValuesLOC = JSON.parse(localStorage.getItem('authorizedValues_LOC') || '{}');
        
        // If we have a mapping for this code, use it
        if (authorizedValuesLOC[locationCode]) {
          console.log(`Found location mapping for "${locationCode}": "${authorizedValuesLOC[locationCode]}"`);
          return authorizedValuesLOC[locationCode];
        }
        
        // No mapping found, return the original code
        console.log(`No location mapping found for "${locationCode}", using code as is`);
        return locationCode;
      } catch (error) {
        console.error('Error accessing location mappings:', error);
        return locationCode;
      }
    },
    
    // Update initializeData to use the mapping from localStorage
    initializeData() {
      if (!this.lastScannedItem) {
        console.log("No lastScannedItem available, cannot initialize data");
        this.currentItem = null;
        this.allItems = [];
        return;
      }

      console.log("Initializing with lastScannedItem:", this.lastScannedItem.external_id);
      
      // Map location code to full name using authorized values
      const locationCode = this.lastScannedItem.location || '';
      const locationName = this.mapLocationCodeToName(locationCode);
      
      console.log(`Using location "${locationName}" for current item`);
      
      // Initialize current item with location name instead of code
      this.currentItem = {
        barcode: this.lastScannedItem.external_id || '',
        call_number: this.lastScannedItem.callnumber || '',
        cn_sort: this.lastScannedItem.call_number_sort || '',
        location: locationName, // Use location name from mapping
        library: this.lastScannedItem.holding_library_id || '',
        title: this.getBiblioTitle(this.lastScannedItem),
        author: this.getBiblioAuthor(this.lastScannedItem)
      };
      
      console.log("Current item initialized:", this.currentItem);
      
      // Process location_data
      if (this.sessionData?.response_data?.location_data && 
          Array.isArray(this.sessionData.response_data.location_data)) {
        
        this.allItems = this.sessionData.response_data.location_data.map(item => ({
          barcode: item.barcode || item.external_id || '',
          call_number: item.itemcallnumber || item.callnumber || '',
          cn_sort: item.cn_sort || item.call_number_sort || '',
          location: item.location || '', // This is already the location name
          library: item.homebranch || item.holding_library_id || '',
          title: item.title || 'Unknown Title',
          author: item.author || 'Unknown Author',
          checked_out: item.onloan || false,
          missing: item.itemlost === 'Missing' || item.itemlost === '1' || false,
          in_transit: false,
          on_hold: false
        }));
        
        console.log(`Initialized ${this.allItems.length} items from location_data`);
        
        // Log sample items to verify
        if (this.allItems.length > 0) {
          console.log("Sample processed items:");
          for (let i = 0; i < Math.min(3, this.allItems.length); i++) {
            console.log(`Item ${i}:`, this.allItems[i]);
          }
        }
        
        // Now fetch upcoming items
        this.fetchUpcomingItems();
      } else {
        console.log("No location_data available in sessionData");
        this.allItems = [];
      }
    }
  },
  
  created() {
    // Log what's available at creation time
    console.log("ShelfPreview - created with:", {
      show: this.show,
      hasLastScannedItem: !!this.lastScannedItem,
      hasSessionData: !!this.sessionData
    });
  },
  
  mounted() {
    // Initialize on mount if the component is shown and we have a lastScannedItem
    if (this.show && this.lastScannedItem) {
      console.log("ShelfPreview - mounted with show=true and lastScannedItem available");
      this.initializeData();
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