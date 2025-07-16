<template>
  <div v-if="show" class="resolution-modal-overlay">
    <div class="resolution-modal">
      <div class="resolution-modal-header">
        <h2>{{ title }}</h2>
        <button class="close-button" @click="close">&times;</button>
      </div>
      
      <div class="resolution-modal-body">
        <div v-if="loading" class="loading-indicator">
          <div class="spinner"></div>
          <p>Processing...</p>
        </div>
        
        <div v-else>
          <div class="item-details" v-if="item">
            <div class="item-info">
              <h3>{{ item.biblio?.title || 'Unknown Title' }}</h3>
              <p><strong>Barcode:</strong> {{ item.external_id || item.barcode }}</p>
              <p><strong>Call Number:</strong> {{ item.call_number || 'N/A' }}</p>
              
              <div v-if="type === 'checkedout'" class="issue-details">
                <p><strong>Checked out to:</strong> {{ patronName || 'Unknown Patron' }}</p>
                <p><strong>Due date:</strong> {{ formatDate(item.due_date) }}</p>
              </div>
              
              <div v-if="type === 'lost'" class="issue-details">
                <p><strong>Lost status:</strong> {{ getLostStatusLabel(item.lost_status) }}</p>
                <p v-if="item.lost_on"><strong>Lost on:</strong> {{ formatDate(item.lost_on) }}</p>
                <div class="lost-status-badge">
                  {{ getLostStatusLabel(item.lost_status) }}
                </div>
                <p v-if="item.itemlost_on" class="additional-info">
                  <strong>Status changed on:</strong> {{ formatDate(item.itemlost_on) }}
                </p>
              </div>
              
              <div v-if="type === 'intransit'" class="issue-details">
                <p><strong>From:</strong> {{ getBranchName(item.homebranch) }}</p>
                <p><strong>To:</strong> {{ getBranchName(item.holdingbranch) }}</p>
              </div>
              
              <div v-if="type === 'returnclaim'" class="issue-details">
                <p><strong>Return claimed on:</strong> {{ formatDate(item.return_claim_date) }}</p>
                <p><strong>Claimed by:</strong> {{ item.return_claim_patron || 'Unknown Patron' }}</p>
              </div>
            </div>
          </div>
          
          <div class="resolution-options">
            <h4>Choose an action:</h4>
            
            <div v-if="type === 'checkedout'">
              <div class="option">
                <input type="radio" id="option-checkin" v-model="selectedAction" value="checkin">
                <label for="option-checkin">Check in the item</label>
                <p class="description">Mark the item as returned and complete the checkout process.</p>
              </div>
              
              <div class="option">
                <input type="radio" id="option-renew" v-model="selectedAction" value="renew">
                <label for="option-renew">Renew the checkout</label>
                <p class="description">Extend the due date for the current patron.</p>
              </div>
              
              <div class="option">
                <input type="radio" id="option-skip" v-model="selectedAction" value="skip">
                <label for="option-skip">Skip (leave as is)</label>
                <p class="description">Don't change the checkout status but record the item in inventory.</p>
              </div>
            </div>
            
            <div v-if="type === 'lost'">
              <div class="option">
                <input type="radio" id="option-found" v-model="selectedAction" value="found">
                <label for="option-found">Mark as found</label>
                <p class="description">Clear the lost status and update the 'last seen' date.</p>
              </div>
              
              <div class="option">
                <input type="radio" id="option-skip-lost" v-model="selectedAction" value="skip">
                <label for="option-skip-lost">Skip (leave as is)</label>
                <p class="description">Don't change the lost status but record the item in inventory.</p>
              </div>
            </div>
            
            <div v-if="type === 'intransit'">
              <div class="option">
                <input type="radio" id="option-resolve" v-model="selectedAction" value="resolve">
                <label for="option-resolve">Resolve transit</label>
                <p class="description">Complete the transit process to the current branch.</p>
              </div>
              
              <div class="option">
                <input type="radio" id="option-skip-transit" v-model="selectedAction" value="skip">
                <label for="option-skip-transit">Skip (leave as is)</label>
                <p class="description">Don't change the transit status but record the item in inventory.</p>
              </div>
            </div>
            
            <div v-if="type === 'returnclaim'">
              <div class="option">
                <input type="radio" id="option-resolve-claim" v-model="selectedAction" value="resolve">
                <label for="option-resolve-claim">Resolve claim</label>
                <p class="description">Mark the claim as resolved and check in the item.</p>
              </div>
              
              <div class="option">
                <input type="radio" id="option-skip-claim" v-model="selectedAction" value="skip">
                <label for="option-skip-claim">Skip (leave as is)</label>
                <p class="description">Don't resolve the claim but record the item in inventory.</p>
              </div>
            </div>
            
            <div v-if="type === 'withdrawn'">
              <div class="option">
                <input type="radio" id="option-restore" v-model="selectedAction" value="restore">
                <label for="option-restore">Restore to circulation</label>
                <p class="description">Remove the withdrawn status and return the item to circulation.</p>
              </div>
              
              <div class="option">
                <input type="radio" id="option-skip-withdrawn" v-model="selectedAction" value="skip">
                <label for="option-skip-withdrawn">Skip (leave as is)</label>
                <p class="description">Keep the withdrawn status and record the item in inventory.</p>
              </div>
            </div>
          </div>
          
          <div class="resolution-actions">
            <button class="cancel-button" @click="close">Cancel</button>
            <button class="resolve-button" @click="resolve" :disabled="!selectedAction">
              {{ resolveButtonText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { EventBus } from './eventBus';

export default {
  props: {
    show: {
      type: Boolean,
      default: false
    },
    item: {
      type: Object,
      default: null
    },
    type: {
      type: String,
      validator: value => ['checkedout', 'lost', 'intransit', 'returnclaim', 'withdrawn'].includes(value),
      required: true
    },
    patronName: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      selectedAction: '',
      loading: false,
      branches: {},
      lostStatuses: {}
    };
  },
  computed: {
    title() {
      const titles = {
        checkedout: 'Checked Out Item',
        lost: 'Lost Item',
        intransit: 'In-Transit Item',
        returnclaim: 'Return Claim',
        withdrawn: 'Withdrawn Item'
      };
      return titles[this.type] || 'Item Issue';
    },
    resolveButtonText() {
      const texts = {
        checkin: 'Check In',
        renew: 'Renew',
        found: 'Mark Found',
        resolve: 'Resolve',
        restore: 'Restore',
        skip: 'Skip'
      };
      return texts[this.selectedAction] || 'Proceed';
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        // Reset selected action when modal is shown
        this.selectedAction = this.getDefaultAction();
        
        // Load branches and lost statuses if needed
        if (Object.keys(this.branches).length === 0) {
          this.loadBranches();
        }
        
        if (Object.keys(this.lostStatuses).length === 0) {
          this.loadLostStatuses();
        }
      }
    }
  },
  methods: {
    getDefaultAction() {
      const defaults = {
        checkedout: 'checkin',
        lost: 'found',
        intransit: 'resolve',
        returnclaim: 'resolve',
        withdrawn: 'restore'
      };
      return defaults[this.type] || '';
    },
    
    close() {
      this.$emit('close');
    },
    
    async resolve() {
      if (!this.selectedAction || !this.item) return;
      
      this.loading = true;
      
      try {
        let result = false;
        const barcode = this.item.external_id || this.item.barcode;
        
        switch(this.type) {
          case 'checkedout':
            if (this.selectedAction === 'checkin') {
              result = await this.checkInItem(barcode);
            } else if (this.selectedAction === 'renew') {
              result = await this.renewItem(barcode);
            } else if (this.selectedAction === 'skip') {
              // No action needed for skip
              result = true;
            }
            break;
            
          case 'lost':
            if (this.selectedAction === 'found') {
              result = await this.markItemFound(barcode);
            } else if (this.selectedAction === 'skip') {
              // No action needed for skip
              result = true;
            }
            break;
            
          case 'intransit':
            if (this.selectedAction === 'resolve') {
              result = await this.resolveTransit(barcode);
            } else if (this.selectedAction === 'skip') {
              // No action needed for skip
              result = true;
            }
            break;
            
          case 'returnclaim':
            if (this.selectedAction === 'resolve') {
              result = await this.resolveReturnClaim(barcode);
            } else if (this.selectedAction === 'skip') {
              // No action needed for skip
              result = true;
            }
            break;
            
          case 'withdrawn':
            if (this.selectedAction === 'restore') {
              result = await this.removeWithdrawnStatus(barcode);
            } else if (this.selectedAction === 'skip') {
              // No action needed for skip
              result = true;
            }
            break;
        }
        
        if (result) {
          // Emit a success event with the action that was taken
          this.$emit('resolved', {
            item: this.item,
            action: this.selectedAction,
            type: this.type,
            result: result
          });
          
          // Close the modal
          this.close();
        }
      } catch (error) {
        console.error(`Error resolving ${this.type}:`, error);
        EventBus.emit('message', {
          type: 'error',
          text: `Error resolving ${this.type}: ${error.message}`
        });
      } finally {
        this.loading = false;
      }
    },
    
    async checkInItem(barcode) {
      try {
        EventBus.emit('message', {
          type: 'status',
          text: `Checking in item ${barcode}...`
        });
        
        const response = await fetch('/api/v1/contrib/interactiveinventory/item/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            barcode: barcode,
            date: new Date().toISOString().split('T')[0]
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          let message = `Item ${barcode} has been checked in successfully`;
          if (data.needs_transfer) {
            message = `Item ${barcode} checked in and needs transfer to ${data.transfer_to}. Please initiate transfer process.`;
          }
          EventBus.emit('message', {
            type: 'success',
            text: message
          });
          return data;
        } else {
          throw new Error(data.error || 'Unknown error checking in item');
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to check in item: ${error.message}`
        });
        throw error;
      }
    },
    
    async renewItem(barcode) {
      try {
        EventBus.emit('message', {
          type: 'status',
          text: `Renewing item ${barcode}...`
        });

        // Use the plugin's renewal endpoint
        const response = await fetch('/api/v1/contrib/interactiveinventory/item/renew', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            barcode: barcode,
            seen: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }

        const data = await response.json();

        EventBus.emit('message', {
          type: 'success',
          text: `Item ${barcode} has been renewed successfully. New due date: ${data.new_due_date}`
        });

        return true;
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to renew item: ${error.message}`
        });
        throw error;
      }
    },
    
    async markItemFound(barcode) {
      try {
        // Log the current lost status for debugging
        const lostStatus = this.item.lost_status;
        const lostStatusLabel = this.getLostStatusLabel(lostStatus);
        
        console.log(`Marking item ${barcode} as found. Current lost status:`, {
          status: lostStatus,
          description: lostStatusLabel
        });
        
        EventBus.emit('message', {
          type: 'status',
          text: `Marking item ${barcode} as found (was: ${lostStatusLabel})...`
        });
        
        const response = await fetch('/api/v1/contrib/interactiveinventory/item/field', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            barcode: barcode,
            fields: {
              itemlost: '0',
              datelastseen: new Date().toISOString().split('T')[0]
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          EventBus.emit('message', {
            type: 'success',
            text: `Item ${barcode} has been marked as found (was: ${lostStatusLabel})`
          });
          return true;
        } else {
          throw new Error(data.error || 'Unknown error marking item as found');
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to mark item as found: ${error.message}`
        });
        throw error;
      }
    },
    
    async resolveTransit(barcode) {
      try {
        EventBus.emit('message', {
          type: 'status',
          text: `Resolving transit for item ${barcode}...`
        });
        
        // Get current session info to determine branch
        const sessionResponse = await fetch('/api/v1/auth/session', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!sessionResponse.ok) {
          throw new Error(`HTTP error ${sessionResponse.status}`);
        }
        
        const sessionData = await sessionResponse.json();
        const branchcode = sessionData.branch;
        
        // Call our plugin API endpoint to resolve the transit
        const response = await fetch('/api/v1/contrib/interactiveinventory/item/resolve_transit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            barcode: barcode,
            branchCode: branchcode
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.status === 'success') {
          EventBus.emit('message', {
            type: 'success',
            text: `Transit for item ${barcode} has been resolved`
          });
          return true;
        } else {
          throw new Error(data?.error || 'Unknown error resolving transit');
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to resolve transit: ${error.message}`
        });
        throw error;
      }
    },
    
    async resolveReturnClaim(barcode) {
      try {
        EventBus.emit('message', {
          type: 'status',
          text: `Resolving return claim for item ${barcode}...`
        });
        
        // Get item details to find the claim ID
        const itemResponse = await fetch(`/api/v1/items?external_id=${encodeURIComponent(barcode)}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!itemResponse.ok) {
          throw new Error(`Failed to fetch item: ${itemResponse.statusText}`);
        }
        
        const items = await itemResponse.json();
        if (!items || items.length === 0) {
          throw new Error(`Item not found with barcode: ${barcode}`);
        }
        
        const item = items[0];
        
        // Get all claims for this item
        const claimsResponse = await fetch(`/api/v1/return_claims?q={"itemnumber":${item.itemnumber},"resolved":0}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!claimsResponse.ok) {
          throw new Error(`Failed to fetch claims: ${claimsResponse.statusText}`);
        }
        
        const claimsData = await claimsResponse.json();
        
        if (!claimsData || claimsData.length === 0) {
          throw new Error(`No unresolved return claims found for item ${barcode}`);
        }
        
        // Get current user details for the resolution
        const userResponse = await fetch('/api/v1/auth/session', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!userResponse.ok) {
          throw new Error(`Failed to fetch user session: ${userResponse.statusText}`);
        }
        
        const userData = await userResponse.json();
        const userId = userData.patron_id;
        
        // Resolve each claim using Koha's native API
        let resolvedClaims = 0;
        for (const claim of claimsData) {
          const resolveResponse = await fetch(`/api/v1/return_claims/${claim.id}/resolve`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              resolution: 'FOUND',
              resolved_by: userId,
              new_lost_status: '0'  // Set to not lost
            })
          });
          
          if (resolveResponse.ok) {
            resolvedClaims++;
          } else {
            const errorData = await resolveResponse.json();
            throw new Error(`Error resolving claim ${claim.id}: ${errorData.error || 'Unknown error'}`);
          }
        }
        
        // Check if item is checked out - if so, check it in
        if (item.checkout) {
          await this.checkInItem(barcode);
        }
        
        EventBus.emit('message', {
          type: 'success',
          text: `Successfully resolved ${resolvedClaims} return claim(s) for item ${barcode}`
        });
        
        return true;
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Error resolving return claim: ${error.message}`
        });
        throw error;
      }
    },
    
    async removeWithdrawnStatus(barcode) {
      try {
        // API call to update the withdrawn status using the existing endpoint
        const response = await fetch('/api/v1/contrib/interactiveinventory/item/field', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            barcode: barcode,
            fields: {
              withdrawn: '0'
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          EventBus.emit('message', {
            type: 'success',
            text: `Withdrawn status removed from item ${barcode}`
          });
          return true;
        } else {
          throw new Error(data.error || 'Unknown error removing withdrawn status');
        }
      } catch (error) {
        EventBus.emit('message', {
          type: 'error',
          text: `Failed to remove withdrawn status: ${error.message}`
        });
        throw error;
      }
    },
    
    async loadBranches() {
      try {
        const response = await fetch('/api/v1/libraries', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data) {
          this.branches = data.reduce((acc, branch) => {
            acc[branch.library_id] = branch.name;
            return acc;
          }, {});
        }
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    },
    
    async loadLostStatuses() {
      try {
        // First try to get lost statuses from localStorage
        const cachedLostStatuses = localStorage.getItem('authorizedValues_LOST');
        
        if (cachedLostStatuses) {
          console.log('Using cached LOST statuses from localStorage');
          try {
            const parsedStatuses = JSON.parse(cachedLostStatuses);
            this.lostStatuses = parsedStatuses;
            return;
          } catch (parseError) {
            console.error('Error parsing cached LOST statuses:', parseError);
            // Continue to API call on parse error
          }
        }
        
        // Fall back to API call if no cache or parse error
        console.log('Fetching LOST statuses from API');
        const response = await fetch('/api/v1/authorised_value_types/LOST/authorised_values', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data) {
          this.lostStatuses = data.reduce((acc, status) => {
            acc[status.authorised_value] = status.description;
            return acc;
          }, {});
        }
      } catch (error) {
        console.error('Error loading lost statuses:', error);
        // Use a basic fallback for lost statuses if everything fails
        this.lostStatuses = {
          '1': 'Lost',
          '2': 'Long Overdue',
          '3': 'Lost and Paid For',
          '4': 'Missing',
          '5': 'Missing in Inventory'
        };
      }
    },
    
    getBranchName(branchCode) {
      return this.branches[branchCode] || branchCode;
    },
    
    getLostStatusLabel(status) {
      // Check if we have a description for this status
      if (this.lostStatuses[status]) {
        return this.lostStatuses[status];
      } 
      
      // Try to check if we can get from localStorage as a backup
      try {
        const cachedStatuses = localStorage.getItem('authorizedValues_LOST');
        if (cachedStatuses) {
          const parsedStatuses = JSON.parse(cachedStatuses);
          if (parsedStatuses[status]) {
            // Save for future use
            this.lostStatuses = { ...this.lostStatuses, ...parsedStatuses };
            return parsedStatuses[status];
          }
        }
      } catch (e) {
        console.error('Error retrieving lost status from cache:', e);
      }
      
      // If no description is found, return a formatted fallback
      return `Lost Status: ${status}`;
    },
    
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      
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
.resolution-modal-overlay {
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

.resolution-modal {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.resolution-modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resolution-modal-header h2 {
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

.resolution-modal-body {
  padding: 20px;
  overflow-y: auto;
}

.item-details {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.item-info h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.item-info p {
  margin: 5px 0;
  color: #555;
}

.issue-details {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.lost-status-badge {
  display: inline-block;
  margin-top: 10px;
  padding: 5px 10px;
  background-color: #ff5252;
  color: white;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.9rem;
}

.additional-info {
  margin-top: 10px;
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
}

.resolution-options {
  margin-bottom: 20px;
}

.resolution-options h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.option {
  margin-bottom: 15px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.option:hover {
  background-color: #f9f9f9;
}

.option input[type="radio"] {
  margin-right: 10px;
}

.option label {
  font-weight: bold;
  cursor: pointer;
}

.description {
  margin-top: 5px;
  margin-left: 25px;
  font-size: 0.9rem;
  color: #666;
}

.resolution-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-button, .resolve-button {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.cancel-button {
  background-color: #f5f5f5;
  border: 1px solid #ccc;
  color: #333;
}

.resolve-button {
  background-color: #4CAF50;
  border: 1px solid #4CAF50;
  color: white;
}

.resolve-button:disabled {
  background-color: #a5d6a7;
  border-color: #a5d6a7;
  cursor: not-allowed;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
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
</style> 