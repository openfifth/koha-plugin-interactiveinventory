<template>
  <div
    :class="[
      'item',
      {
        highlight: hasIssue,
        'checked-out': item.checked_out_date,
        'in-transit': item.in_transit && alertSettings.showInTransitAlerts,
        'branch-mismatch':
          item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts,
        withdrawn:
          (item.withdrawn === '1' || item.withdrawn === 1) && alertSettings.showWithdrawnAlerts,
        'on-hold': item.on_hold && alertSettings.showOnHoldAlerts,
        'return-claim': item.return_claim && alertSettings.showReturnClaimAlerts
      }
    ]"
    @click="toggleExpand"
  >
    <p class="item-title">
      <span :class="issueIconClass" aria-hidden="true">{{ issueIcon }}</span>
      <span class="sr-only">{{ issueIconText }}</span>
      <span class="badge-spacer"></span>
      <span v-if="item.checked_out_date" class="checked-out-badge">CHECKED OUT</span>
      <span v-if="item.in_transit && alertSettings.showInTransitAlerts" class="in-transit-badge"
        >IN TRANSIT</span
      >
      <span
        v-if="item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts"
        class="branch-mismatch-badge"
        >BRANCH MISMATCH</span
      >
      <span
        v-if="(item.withdrawn === '1' || item.withdrawn === 1) && alertSettings.showWithdrawnAlerts"
        class="withdrawn-badge"
        >WITHDRAWN</span
      >
      <span v-if="item.on_hold && alertSettings.showOnHoldAlerts" class="on-hold-badge"
        >ON HOLD</span
      >
      <span
        v-if="item.return_claim && alertSettings.showReturnClaimAlerts"
        class="return-claim-badge"
        >RETURN CLAIM</span
      >
      <span v-if="item.pendingResolution" class="resolution-badge">PENDING RESOLUTION</span>
      <span
        v-if="item.resolutionAction && !item.pendingResolution"
        class="resolution-badge-resolved"
        >✓ RESOLVED</span
      >
      <span v-if="item.resolutionAction && item.pendingResolution" class="resolution-badge-skipped"
        >SKIPPED</span
      >
      <span v-if="item.hold_found" class="hold-found-badge">HOLD FOUND</span>
      <span v-if="item.needs_transfer" class="transfer-badge">NEEDS TRANSFER</span>
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
        <p>{{ getLocationDisplay(item.location) }}</p>
        <p><strong>Item Type:</strong></p>
        <p>{{ getItemTypeDisplay(item.item_type_id || item.itype) }}</p>
        <p><strong>Home Library:</strong></p>
        <p>{{ item.homebranch || item.home_library_id || 'N/A' }}</p>
        <p><strong>Holding Library:</strong></p>
        <p>{{ item.holdingbranch || item.holding_library_id || 'N/A' }}</p>
        <p><strong>Acquisition Date:</strong></p>
        <p>{{ item.acquisition_date }}</p>
        <p><strong>Last Seen Date:</strong></p>
        <p>{{ item.last_seen_date }}</p>
        <p><strong>URL:</strong></p>
        <p>
          <a :href="constructedUrl" target="_blank" @click.stop>{{ constructedUrl }}</a>
        </p>

        <!-- Resolution information -->
        <p v-if="item.pendingResolution || item.resolutionAction" class="item-warning">
          <strong>Resolution Status:</strong>
        </p>
        <p v-if="item.pendingResolution || item.resolutionAction" class="item-warning">
          <span v-if="item.pendingResolution">
            This item has a pending {{ item.resolutionType }} issue that needs to be resolved.
            <span v-if="item.resolutionAction === 'skipped'"> (Skipped during resolution)</span>
          </span>
          <span v-else-if="item.resolutionAction">
            This item had a {{ item.resolutionType }} issue that was resolved - action taken:
            {{ item.resolutionAction }}.
          </span>
        </p>

        <p v-if="item.wasLost" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.wasLost" class="item-warning">
          This item was previously marked as lost. Reason: {{ lostReason }}
        </p>
        <p v-if="item.wasWithdrawn" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.wasWithdrawn" class="item-warning">
          This item was previously withdrawn from circulation.
        </p>
        <p v-if="item.wrongPlace" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.wrongPlace" class="item-warning">
          This item is not in the expected barcodes list{{ item.wrongPlaceReason || '' }}.
        </p>
        <p v-if="item.checked_out_date" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.checked_out_date" class="item-warning">
          This item was checked out on: {{ item.checked_out_date }}
          <span v-if="item.resolutionAction === 'checked in'"> and has been checked in. </span>
          <span v-else-if="item.resolutionAction === 'renewed'"> and has been renewed. </span>
          <span v-else-if="item.resolutionAction === 'skipped'">
            and was left as checked out.
          </span>
          <span v-else-if="sessionData.doNotCheckIn"> and has not been checked in. </span>
          <span v-else> and has been checked in automatically. </span>
        </p>
        <p v-if="item.hold_found" class="item-warning"><strong>Hold Found:</strong></p>
        <p v-if="item.hold_found" class="item-warning" v-html="holdFoundMessage"></p>
        <p v-if="item.needs_transfer && !item.hold_needs_transfer" class="item-warning">
          <strong>Transfer Required:</strong>
        </p>
        <p v-if="item.needs_transfer && !item.hold_needs_transfer" class="item-warning">
          This item needs to be transferred to {{ item.transfer_to }}. Please initiate the transfer
          process to move this item to its correct location.
        </p>
        <p v-if="item.in_transit && alertSettings.showInTransitAlerts" class="item-warning">
          <strong>Warning:</strong>
        </p>
        <p v-if="item.in_transit && alertSettings.showInTransitAlerts" class="item-warning">
          <span v-if="item.transitInfo">
            This item is in transit {{ getTransitDescription(item.transitInfo) }} from
            {{ item.transitInfo.from || item.homebranch }} to
            {{ item.transitInfo.to || item.holdingbranch }}.
          </span>
          <span v-else>
            This item is currently in transit from {{ item.homebranch }} to
            {{ item.holdingbranch }}.
          </span>
        </p>
        <p
          v-if="item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts"
          class="item-warning"
        >
          <strong>Warning:</strong>
        </p>
        <p
          v-if="item.homebranch !== item.holdingbranch && alertSettings.showBranchMismatchAlerts"
          class="item-warning"
        >
          This item belongs to branch {{ item.homebranch }} but is currently held at branch
          {{ item.holdingbranch }}.
        </p>
        <p
          v-if="
            (item.withdrawn === '1' || item.withdrawn === 1) && alertSettings.showWithdrawnAlerts
          "
          class="item-warning"
        >
          <strong>Warning:</strong>
        </p>
        <p
          v-if="
            (item.withdrawn === '1' || item.withdrawn === 1) && alertSettings.showWithdrawnAlerts
          "
          class="item-warning"
        >
          This item has been withdrawn from circulation.
        </p>
        <p v-if="item.on_hold && alertSettings.showOnHoldAlerts" class="item-warning">
          <strong>Warning:</strong>
        </p>
        <p v-if="item.on_hold && alertSettings.showOnHoldAlerts" class="item-warning">
          This item is currently on hold{{ item.waiting ? ' and waiting for pickup' : '' }}.
          <span v-if="item.waiting">It should not be reshelved.</span>
          <span v-if="item.hold_transit">It is in transit to fulfill a hold.</span>
        </p>
        <p v-if="item.return_claim && alertSettings.showReturnClaimAlerts" class="item-warning">
          <strong>Warning:</strong>
        </p>
        <p v-if="item.return_claim && alertSettings.showReturnClaimAlerts" class="item-warning">
          This item has an unresolved return claim. The patron claims they returned it, but it is
          still checked out in the system.
        </p>
        <p v-if="item.outOfOrder" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.outOfOrder" class="item-warning">
          This item has been scanned out of order. It should have been scanned before
          <a :href="highestCallNumberUrl" target="_blank" @click.stop>{{
            currentItemWithHighestCallNumber
          }}</a
          >.
        </p>
        <p v-if="item.invalidStatus" class="item-warning"><strong>Warning:</strong></p>
        <p v-if="item.invalidStatus" class="item-warning">
          This item has an invalid not for loan status. Please check it is correct using the link
          above.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { EventBus } from './eventBus'

export default {
  props: {
    currentItemWithHighestCallNumber: String,
    currentBiblioWithHighestCallNumber: [Number, String, null],
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
    }
  },
  created() {
    this.fetchAndSetAuthorizedValues('LOST')
  },
  computed: {
    highestCallNumberUrl() {
      const biblioId = this.currentBiblioWithHighestCallNumber
      return biblioId && biblioId !== ''
        ? `/cgi-bin/koha/catalogue/detail.pl?biblionumber=${biblioId}`
        : ''
    },
    hasIssue() {
      if (this.item.resolutionAction && !this.item.pendingResolution) {
        return false
      }

      return (
        this.item.wasLost ||
        this.item.wasWithdrawn ||
        this.item.wrongPlace ||
        this.item.checked_out_date ||
        this.item.outOfOrder ||
        this.item.invalidStatus ||
        (this.item.in_transit && this.alertSettings.showInTransitAlerts) ||
        (this.item.homebranch !== this.item.holdingbranch &&
          this.alertSettings.showBranchMismatchAlerts) ||
        ((this.item.withdrawn === '1' || this.item.withdrawn === 1) &&
          this.alertSettings.showWithdrawnAlerts) ||
        (this.item.on_hold && this.alertSettings.showOnHoldAlerts) ||
        (this.item.return_claim && this.alertSettings.showReturnClaimAlerts) ||
        this.item.pendingResolution
      )
    },
    issueIcon() {
      return this.hasIssue ? '✖' : '✔'
    },
    issueIconClass() {
      return this.hasIssue ? 'text-danger' : 'text-success'
    },
    issueIconText() {
      return this.hasIssue ? 'Item has issues' : 'Item has no issues'
    },
    resolutionBadgeText() {
      return this.item.resolutionAction
        ? this.item.pendingResolution
          ? 'SKIPPED'
          : 'RESOLVED'
        : ''
    },
    resolutionBadgeClass() {
      return this.item.pendingResolution ? 'resolution-badge-skipped' : 'resolution-badge-resolved'
    },
    constructedUrl() {
      const biblionumber = this.item.biblio_id
      return `${window.location.origin}/cgi-bin/koha/catalogue/detail.pl?biblionumber=${biblionumber}`
    },
    lostReason() {
      const lostStatusValue = this.item.lost_status
      const reason = this.authorizedValues[lostStatusValue]
      return reason || 'Unknown'
    },
    holdFoundMessage() {
      if (!this.item.hold_found) return ''
      let msg = 'This item has been trapped for a hold'
      if (this.item.hold_patron_name) {
        msg += ` for <strong>${this.item.hold_patron_name}</strong>`
      }
      if (this.item.hold_needs_transfer) {
        msg += `. Transfer to <strong>${this.item.hold_pickup_branch}</strong> for pickup.`
      } else {
        msg += '. Do not reshelve.'
      }
      return msg
    }
  },
  methods: {
    getTransitDescription(transitInfo) {
      if (!transitInfo || !transitInfo.inTransit) return ''

      switch (transitInfo.type) {
        case 'hold':
          return 'to fulfill a hold'
        case 'return':
          return 'returning to its home/holding branch'
        case 'manual':
          return 'via manual transfer'
        case 'stockrotation':
          return 'for stock rotation'
        case 'collection':
          return 'for rotating collection'
        case 'recall':
          return 'to fulfill a recall'
        case 'cancelled':
          return 'for cancelled hold/recall'
        default:
          return `(${transitInfo.reason || 'unknown reason'})`
      }
    },

    toggleExpand() {
      this.$emit('toggleExpand', `${this.index}-${this.item.id}`)
    },
    async fetchAndSetAuthorizedValues(field) {
      try {
        const values = await this.fetchAuthorizedValues(field, {
          onValuesUpdate: (updatedValues) => {
            this.authorizedValues = { ...updatedValues }
          },
          forceLoad: false
        })

        this.authorizedValues = values
      } catch (error) {
        EventBus.emit('message', { type: 'error', text: 'Error setting authorized values' })
      }
    },

    getLocationDisplay(locationCode) {
      if (!locationCode) return 'N/A'
      // Use shelvingLocations from sessionData to look up description
      const locations = this.sessionData?.shelvingLocations
      if (locations && locations[locationCode]) {
        return locations[locationCode]
      }
      return locationCode
    },

    getItemTypeDisplay(itemTypeCode) {
      if (!itemTypeCode) return 'N/A'
      // Use iTypes from sessionData to look up description
      const itemTypes = this.sessionData?.iTypes
      if (itemTypes) {
        const itemType = itemTypes.find((t) => t.itemtype === itemTypeCode)
        if (itemType) {
          return itemType.description || itemTypeCode
        }
      }
      return itemTypeCode
    }
  }
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
  overflow-wrap: break-word;
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
  border-left: 4px solid #17a2b8;
  background-color: rgba(23, 162, 184, 0.1);
}

.on-hold-badge {
  display: inline-block;
  background-color: #17a2b8;
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

.resolution-badge {
  display: inline-block;
  background-color: #8e44ad;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.resolution-badge-resolved {
  display: inline-block;
  background-color: #2ecc71;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.resolution-badge-skipped {
  display: inline-block;
  background-color: #7f8c8d;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.hold-found-badge {
  display: inline-block;
  background-color: #e74c3c;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.transfer-badge {
  display: inline-block;
  background-color: #f39c12;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 8px;
  font-weight: bold;
}

.badge-spacer {
  display: inline-block;
  width: 8px;
}
</style>
