/**
 * Pure analysis functions for item status evaluation.
 * No reactive state — all functions take an item object and return analysis results.
 *
 * Note: analyzeItemStatus requires a getTransitInfoFn parameter because
 * getTransitInfo/getTransitType remain in the component (not extracted).
 */

export function analyzeItemStatus(item, getTransitInfoFn) {
  return {
    checkout: analyzeCheckoutStatus(item),
    lost: analyzeLostStatus(item),
    withdrawn: analyzeWithdrawnStatus(item),
    damaged: analyzeDamagedStatus(item),
    hold: analyzeHoldStatus(item),
    transit: getTransitInfoFn(item),
    returnClaim: analyzeReturnClaimStatus(item),
    branch: analyzeBranchStatus(item),
    restrictions: analyzeRestrictions(item)
  }
}

export function analyzeCheckoutStatus(item) {
  return {
    isCheckedOut: !!item.checked_out_date,
    checkoutDate: item.checked_out_date,
    dueDate: item.due_date,
    isOverdue: item.due_date && new Date(item.due_date) < new Date()
  }
}

export function analyzeLostStatus(item) {
  const isLost = item.lost_status && item.lost_status !== '0'
  return {
    isLost,
    lostStatus: item.lost_status,
    lostDate: item.lost_date,
    lostDescription: isLost ? getLostDescription(item.lost_status) : null
  }
}

export function analyzeWithdrawnStatus(item) {
  const isWithdrawn = item.withdrawn === '1' || item.withdrawn === 1
  return {
    isWithdrawn,
    withdrawnStatus: item.withdrawn,
    withdrawnDate: item.withdrawn_date
  }
}

export function analyzeDamagedStatus(item) {
  const isDamaged = item.damaged_status && item.damaged_status !== '0'
  return {
    isDamaged,
    damagedStatus: item.damaged_status,
    damagedDate: item.damaged_date
  }
}

export function analyzeHoldStatus(item) {
  return {
    hasHold: !!item.first_hold,
    isWaiting: !!item.waiting,
    holdDetails: item.first_hold
  }
}

export function analyzeReturnClaimStatus(item) {
  return {
    hasReturnClaim: !!item.return_claim,
    claimDetails: item.return_claim,
    claimsCount: Array.isArray(item.return_claims) ? item.return_claims.length : 0
  }
}

export function analyzeBranchStatus(item) {
  // Support both API field names (home_library_id/holding_library_id) and
  // GetItemsForInventory field names (homebranch) with fallbacks
  const homeBranch = item.homebranch || item.home_library_id
  const holdingBranch = item.holdingbranch || item.holding_library_id
  const hasBranchMismatch = homeBranch !== holdingBranch
  return {
    hasBranchMismatch,
    homeBranch,
    holdingBranch,
    needsTransfer: hasBranchMismatch && !item.checked_out_date
  }
}

export function analyzeRestrictions(item) {
  return {
    isRestricted: item.restricted_status && item.restricted_status !== '0',
    restrictedStatus: item.restricted_status,
    notForLoan: item.not_for_loan_status && item.not_for_loan_status !== 0,
    notForLoanStatus: item.not_for_loan_status
  }
}

export function getProblematicStatuses(statusAnalysis) {
  const issues = []

  if (statusAnalysis.checkout.isOverdue) {
    issues.push({ type: 'overdue', severity: 'high', message: 'Item is overdue' })
  }

  if (statusAnalysis.lost.isLost) {
    issues.push({
      type: 'lost',
      severity: 'high',
      message: statusAnalysis.lost.lostDescription
    })
  }

  if (statusAnalysis.withdrawn.isWithdrawn) {
    issues.push({ type: 'withdrawn', severity: 'medium', message: 'Item is withdrawn' })
  }

  if (statusAnalysis.damaged.isDamaged) {
    issues.push({ type: 'damaged', severity: 'medium', message: 'Item is damaged' })
  }

  if (statusAnalysis.returnClaim.hasReturnClaim) {
    issues.push({
      type: 'return_claim',
      severity: 'high',
      message: 'Item has unresolved return claim'
    })
  }

  if (statusAnalysis.transit.inTransit) {
    const transitMsg = `Item in transit`
    issues.push({ type: 'transit', severity: 'low', message: transitMsg })
  }

  if (statusAnalysis.branch.hasBranchMismatch && !statusAnalysis.checkout.isCheckedOut) {
    issues.push({
      type: 'branch_mismatch',
      severity: 'medium',
      message: 'Item at wrong branch'
    })
  }

  if (statusAnalysis.hold.hasHold && statusAnalysis.hold.isWaiting) {
    issues.push({
      type: 'waiting_hold',
      severity: 'high',
      message: 'Item has hold waiting for pickup'
    })
  }

  return issues.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 }
    return severityOrder[b.severity] - severityOrder[a.severity]
  })
}

export function getLostDescription(lostStatus) {
  // This could be enhanced to fetch authorized values
  const lostDescriptions = {
    1: 'Lost',
    2: 'Long Overdue (Lost)',
    3: 'Lost and Paid For',
    4: 'Missing'
  }
  return lostDescriptions[lostStatus] || `Lost Status: ${lostStatus}`
}
