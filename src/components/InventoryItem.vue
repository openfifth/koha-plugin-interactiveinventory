<template>
  <div :class="['item', { 
       'highlight': hasIssue, 
       'checked-out': item.checked_out_date,
       'in-transit': item.in_transit && alertSettings.showInTransitAlerts,
       'branch-mismatch': item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts,
       'withdrawn': item.withdrawn === '1' && alertSettings.showWithdrawnAlerts,
       'on-hold': item.on_hold && alertSettings.showOnHoldAlerts,
       'return-claim': item.return_claim && alertSettings.showReturnClaimAlerts
     }]" @click="toggleExpand">
    <p class="item-title">
      <span :class="issueIconClass" aria-hidden="true">{{ issueIcon }}</span>
      <span class="sr-only">{{ issueIconText }}</span>
      <span v-if="item.checked_out_date" class="checked-out-badge">CHECKED OUT</span>
      <span v-if="item.in_transit && alertSettings.showInTransitAlerts" class="in-transit-badge">IN TRANSIT</span>
      <span v-if="item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts" class="branch-mismatch-badge">BRANCH MISMATCH</span>
      <span v-if="item.withdrawn === '1' && alertSettings.showWithdrawnAlerts" class="withdrawn-badge">WITHDRAWN</span>
      <span v-if="item.on_hold && alertSettings.showOnHoldAlerts" class="on-hold-badge">ON HOLD</span>
      <span v-if="item.return_claim && alertSettings.showReturnClaimAlerts" class="return-claim-badge">RETURN CLAIM</span>
      {{ item.biblio.title }} - {{ item.external_id }}
    </p>
    <div v-if="isExpanded" class="item-details">
      <div class="item-details-grid">
        <p><strong>Title:</strong></p>
        <p>{{ item.biblio.title }}</p>
        <p><strong>Author:</strong></p>
        <p>{{ item.biblio.author || 'N/A' }}</p>
        <p><strong>Publication Year:</strong></p>
        <p>{{ item.biblio.publication_year || 'N/A' }}</p>
        <p><strong>Publisher:</strong></p>
        <p>{{ item.biblio.publisher || 'N/A' }}</p>
        <p><strong>ISBN:</strong></p>
        <p>{{ item.biblio.isbn || 'N/A' }}</p>
        <p><strong>Pages:</strong></p>
        <p>{{ item.biblio.pages || 'N/A' }}</p>
        <p><strong>Location:</strong></p>
        <p>{{ item.location }}</p>
        <p><strong>Acquisition Date:</strong></p>
        <p>{{ item.acquisition_date }}</p>
        <p><strong>Last Seen Date:</strong></p>
        <p>{{ item.last_seen_date }}</p>
        <p><strong>URL:</strong></p>
        <p><a :href="constructedUrl" target="_blank" @click.stop>{{ constructedUrl }}</a></p>
        <p v-if="item.wasLost" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.wasLost" class="item-warning">This item was previously marked as lost. Reason: {{ lostReason }}
        </p>
        <p v-if="item.wrongPlace" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.wrongPlace" class="item-warning">This item may be in the wrong place. It is not in the list of
          expected items to be scanned.</p>
        <p v-if="item.checked_out_date" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.checked_out_date" class="item-warning">
          This item was checked out on: {{ item.checked_out_date }}
          <span v-if="sessionData.doNotCheckIn">
            and has not been checked in.
          </span>
          <span v-else>
            and has been checked in automatically.
          </span>
        </p>
        <p v-if="item.in_transit && alertSettings.showInTransitAlerts" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.in_transit && alertSettings.showInTransitAlerts" class="item-warning">
          This item is currently in transit from {{ item.homebranch }} to {{ item.holdingbranch }}.
        </p>
        <p v-if="item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts" class="item-warning">
          This item belongs to branch {{ item.homebranch }} but is currently held at branch {{ item.holdingbranch }}.
        </p>
        <p v-if="item.withdrawn === '1' && alertSettings.showWithdrawnAlerts" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.withdrawn === '1' && alertSettings.showWithdrawnAlerts" class="item-warning">
          This item has been withdrawn from circulation.
        </p>
        <p v-if="item.on_hold && alertSettings.showOnHoldAlerts" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.on_hold && alertSettings.showOnHoldAlerts" class="item-warning">
          This item is currently on hold{{ item.waiting ? ' and waiting for pickup' : '' }}. 
          <span v-if="item.waiting">It should not be reshelved.</span>
          <span v-if="item.hold_transit">It is in transit to fulfill a hold.</span>
        </p>
        <p v-if="item.return_claim && alertSettings.showReturnClaimAlerts" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.return_claim && alertSettings.showReturnClaimAlerts" class="item-warning">
          This item has an unresolved return claim. The patron claims they returned it, but it is still checked out in the system.
        </p>
        <p v-if="item.outOfOrder" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.outOfOrder" class="item-warning">This item has been scanned out of order. It should have been
          scanned before <a :href="highestCallNumberUrl" target="_blank" @click.stop>{{ currentItemWithHighestCallNumber
          }}</a>.
        </p>
        <p v-if="item.invalidStatus" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.invalidStatus" class="item-warning">This item has an invalid not for loan status. Please check it
          is correct using the link above.</p>
      </div>
    </div>
  </div>
</template>



<script>
import { EventBus } from './eventBus';

export default {
  props: {
    currentItemWithHighestCallNumber: String,
    currentBiblioWithHighestCallNumber: Number,
    sessionData: Object,
    item: Object,
    isExpanded: Boolean,
    index: Number,
    fetchAuthorizedValues: {
      type: Function,
      required: true
    },
    barcodeExpected: {
      type: Boolean,
      default: true
    },
    alertSettings: {
      type: Object,
      default: () => ({
        showWithdrawnAlerts: true,
        showOnHoldAlerts: true,
        showInTransitAlerts: true,
        showBranchMismatchAlerts: true,
        showReturnClaimAlerts: true
      })
    }
  },
  data() {
    return {
      authorizedValues: {}
    };
  },
  created() {
    this.fetchAndSetAuthorizedValues('LOST');
  },
  computed: {
    highestCallNumberUrl() {
      return `/cgi-bin/koha/catalogue/detail.pl?biblionumber=${this.currentBiblioWithHighestCallNumber}`;
    },
    hasIssue() {
      return this.item.wasLost || this.item.wrongPlace || this.item.checked_out_date || 
             this.item.outOfOrder || this.item.invalidStatus || 
             (this.item.in_transit && this.alertSettings.showInTransitAlerts) || 
             (this.item.homebranch !== this.item.holdingbranch && this.alertSettings.showBranchMismatchAlerts) ||
             (this.item.withdrawn === '1' && this.alertSettings.showWithdrawnAlerts) || 
             (this.item.on_hold && this.alertSettings.showOnHoldAlerts) ||
             (this.item.return_claim && this.alertSettings.showReturnClaimAlerts);
    },
    issueIcon() {
      return this.hasIssue ? '✖' : '✔';
    },
    issueIconClass() {
      return this.hasIssue ? 'text-danger' : 'text-success';
    },
    issueIconText() {
      return this.hasIssue ? 'Item has issues' : 'Item has no issues';
    },
    constructedUrl() {
      const biblionumber = this.item.biblio_id;
      return `${window.location.origin}/cgi-bin/koha/catalogue/detail.pl?biblionumber=${biblionumber}`;
    },
    lostReason() {
      const lostStatusValue = this.item.lost_status;
      const reason = this.authorizedValues[lostStatusValue];
      return reason || 'Unknown';
    }
  },
  methods: {
    toggleExpand() {
      this.$emit('toggleExpand', `${this.index}-${this.item.id}`);
    },
    async fetchAndSetAuthorizedValues(field) {
      try {
        // Pass a flag to indicate this is for the item component, not the form
        const values = await this.fetchAuthorizedValues(field, {
          onValuesUpdate: (updatedValues) => {
            this.authorizedValues = { ...updatedValues };
          },
          // This indicates we don't need to force a fetch in inventory mode
          forceLoad: false
        });

        // This will only be reached after all values are fetched
        // but we've already updated incrementally via the callback
        this.authorizedValues = values;
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: 'Error setting authorized values' });
      }
    },
  },
}
</script>

<style scoped>
.item {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-bottom: 15px;
  background-color: #fff;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.item:hover {
  background-color: #f1f1f1;
}

.item-title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 10px;
}

.item-details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.item-details p {
  margin: 5px 0;
}

.item-details p strong {
  display: inline-block;
  width: 150px;
}

.item-details a {
  color: #007bff;
  text-decoration: none;
}

.item-details a:hover {
  text-decoration: underline;
}

.highlight {
  border-color: #ff6f61;
}

.item-warning {
  color: #ff6f61;
  font-weight: bold;
  grid-column: span 2;
}

.item-details-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px;
  word-wrap: break-word;
  /* Ensure long text wraps within the column */
  overflow-wrap: break-word;
  /* Alternative property for word wrapping */
}

.checked-out {
  border-left: 4px solid #e74c3c;
  background-color: rgba(231, 76, 60, 0.1);
}

.checked-out-badge {
  display: inline-block;
  background-color: #e74c3c;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.in-transit {
  border-left: 4px solid #f39c12;
  background-color: rgba(243, 156, 18, 0.1);
}

.in-transit-badge {
  display: inline-block;
  background-color: #f39c12;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.branch-mismatch {
  border-left: 4px solid #3498db;
  background-color: rgba(52, 152, 219, 0.1);
}

.branch-mismatch-badge {
  display: inline-block;
  background-color: #3498db;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.withdrawn {
  border-left: 4px solid #9b59b6;
  background-color: rgba(155, 89, 182, 0.1);
}

.withdrawn-badge {
  display: inline-block;
  background-color: #9b59b6;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.on-hold {
  border-left: 4px solid #27ae60;
  background-color: rgba(39, 174, 96, 0.1);
}

.on-hold-badge {
  display: inline-block;
  background-color: #27ae60;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.return-claim {
  border-left: 4px solid #e67e22;
  background-color: rgba(230, 126, 34, 0.1);
}

.return-claim-badge {
  display: inline-block;
  background-color: #e67e22;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}
</style>