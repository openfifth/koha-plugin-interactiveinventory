import { describe, it, expect } from 'vitest'
import {
  analyzeItemStatus,
  analyzeCheckoutStatus,
  analyzeLostStatus,
  analyzeWithdrawnStatus,
  analyzeDamagedStatus,
  analyzeHoldStatus,
  analyzeReturnClaimStatus,
  analyzeBranchStatus,
  analyzeRestrictions,
  getProblematicStatuses,
  getLostDescription
} from '../../src/composables/useItemStatusAnalysis'

// Helper to create test items
function makeItem(overrides = {}) {
  return {
    checked_out_date: null,
    due_date: null,
    lost_status: '0',
    lost_date: null,
    withdrawn: '0',
    withdrawn_date: null,
    damaged_status: '0',
    damaged_date: null,
    first_hold: null,
    waiting: null,
    return_claim: null,
    return_claims: [],
    homebranch: 'LIB_A',
    holding_library_id: 'LIB_A',
    restricted_status: '0',
    not_for_loan_status: 0,
    transfer: null,
    ...overrides
  }
}

describe('analyzeCheckoutStatus', () => {
  it('returns isCheckedOut false when no checkout date', () => {
    const item = makeItem()
    const result = analyzeCheckoutStatus(item)
    expect(result.isCheckedOut).toBe(false)
    expect(result.checkoutDate).toBeNull()
  })

  it('returns isCheckedOut true when checkout date exists', () => {
    const item = makeItem({ checked_out_date: '2025-01-01' })
    const result = analyzeCheckoutStatus(item)
    expect(result.isCheckedOut).toBe(true)
    expect(result.checkoutDate).toBe('2025-01-01')
  })

  it('returns isOverdue true when due date is in the past', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    const item = makeItem({ due_date: pastDate.toISOString() })
    const result = analyzeCheckoutStatus(item)
    expect(result.isOverdue).toBe(true)
  })

  it('returns isOverdue false when due date is in the future', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const item = makeItem({ due_date: futureDate.toISOString() })
    const result = analyzeCheckoutStatus(item)
    expect(result.isOverdue).toBe(false)
  })

  it('returns isOverdue false when no due date', () => {
    const item = makeItem()
    const result = analyzeCheckoutStatus(item)
    expect(result.isOverdue).toBeFalsy()
  })
})

describe('analyzeLostStatus', () => {
  it('returns isLost false when lost_status is 0', () => {
    const item = makeItem({ lost_status: '0' })
    const result = analyzeLostStatus(item)
    expect(result.isLost).toBe(false)
    expect(result.lostDescription).toBeNull()
  })

  it('returns isLost true when lost_status is not 0', () => {
    const item = makeItem({ lost_status: '1' })
    const result = analyzeLostStatus(item)
    expect(result.isLost).toBe(true)
    expect(result.lostStatus).toBe('1')
  })

  it('includes lostDescription when item is lost', () => {
    const item = makeItem({ lost_status: '2' })
    const result = analyzeLostStatus(item)
    expect(result.isLost).toBe(true)
    expect(result.lostDescription).toBe('Long Overdue (Lost)')
  })

  it('includes lost_date in result', () => {
    const item = makeItem({ lost_status: '1', lost_date: '2025-01-01' })
    const result = analyzeLostStatus(item)
    expect(result.lostDate).toBe('2025-01-01')
  })
})

describe('analyzeWithdrawnStatus', () => {
  it('returns isWithdrawn false when withdrawn is 0 (string)', () => {
    const item = makeItem({ withdrawn: '0' })
    const result = analyzeWithdrawnStatus(item)
    expect(result.isWithdrawn).toBe(false)
  })

  it('returns isWithdrawn false when withdrawn is 0 (number)', () => {
    const item = makeItem({ withdrawn: 0 })
    const result = analyzeWithdrawnStatus(item)
    expect(result.isWithdrawn).toBe(false)
  })

  it('returns isWithdrawn true when withdrawn is 1 (string)', () => {
    const item = makeItem({ withdrawn: '1' })
    const result = analyzeWithdrawnStatus(item)
    expect(result.isWithdrawn).toBe(true)
  })

  it('returns isWithdrawn true when withdrawn is 1 (number)', () => {
    const item = makeItem({ withdrawn: 1 })
    const result = analyzeWithdrawnStatus(item)
    expect(result.isWithdrawn).toBe(true)
  })

  it('includes withdrawn_date in result', () => {
    const item = makeItem({ withdrawn: '1', withdrawn_date: '2025-01-01' })
    const result = analyzeWithdrawnStatus(item)
    expect(result.withdrawnDate).toBe('2025-01-01')
  })
})

describe('analyzeDamagedStatus', () => {
  it('returns isDamaged false when damaged_status is 0', () => {
    const item = makeItem({ damaged_status: '0' })
    const result = analyzeDamagedStatus(item)
    expect(result.isDamaged).toBe(false)
  })

  it('returns isDamaged true when damaged_status is not 0', () => {
    const item = makeItem({ damaged_status: '1' })
    const result = analyzeDamagedStatus(item)
    expect(result.isDamaged).toBe(true)
  })

  it('includes damaged_date in result', () => {
    const item = makeItem({ damaged_status: '1', damaged_date: '2025-01-01' })
    const result = analyzeDamagedStatus(item)
    expect(result.damagedDate).toBe('2025-01-01')
  })
})

describe('analyzeHoldStatus', () => {
  it('returns hasHold false when no first_hold', () => {
    const item = makeItem()
    const result = analyzeHoldStatus(item)
    expect(result.hasHold).toBe(false)
    expect(result.isWaiting).toBe(false)
  })

  it('returns hasHold true when first_hold exists', () => {
    const holdData = { hold_id: 1, patron_id: 123 }
    const item = makeItem({ first_hold: holdData })
    const result = analyzeHoldStatus(item)
    expect(result.hasHold).toBe(true)
    expect(result.holdDetails).toEqual(holdData)
  })

  it('returns isWaiting true when waiting flag is set', () => {
    const item = makeItem({ waiting: true })
    const result = analyzeHoldStatus(item)
    expect(result.isWaiting).toBe(true)
  })
})

describe('analyzeReturnClaimStatus', () => {
  it('returns hasReturnClaim false when no return_claim', () => {
    const item = makeItem()
    const result = analyzeReturnClaimStatus(item)
    expect(result.hasReturnClaim).toBe(false)
    expect(result.claimsCount).toBe(0)
  })

  it('returns hasReturnClaim true when return_claim exists', () => {
    const claimData = { claim_id: 1 }
    const item = makeItem({ return_claim: claimData })
    const result = analyzeReturnClaimStatus(item)
    expect(result.hasReturnClaim).toBe(true)
    expect(result.claimDetails).toEqual(claimData)
  })

  it('counts return_claims array length', () => {
    const item = makeItem({
      return_claims: [{ id: 1 }, { id: 2 }, { id: 3 }]
    })
    const result = analyzeReturnClaimStatus(item)
    expect(result.claimsCount).toBe(3)
  })

  it('returns claimsCount 0 when return_claims is not an array', () => {
    const item = makeItem({ return_claims: null })
    const result = analyzeReturnClaimStatus(item)
    expect(result.claimsCount).toBe(0)
  })
})

describe('analyzeBranchStatus', () => {
  it('returns hasBranchMismatch false when branches match', () => {
    const item = makeItem({ homebranch: 'LIB_A', holding_library_id: 'LIB_A' })
    const result = analyzeBranchStatus(item)
    expect(result.hasBranchMismatch).toBe(false)
    expect(result.needsTransfer).toBe(false)
  })

  it('returns hasBranchMismatch true when branches differ', () => {
    const item = makeItem({ homebranch: 'LIB_A', holding_library_id: 'LIB_B' })
    const result = analyzeBranchStatus(item)
    expect(result.hasBranchMismatch).toBe(true)
  })

  it('returns needsTransfer true when branch mismatch and not checked out', () => {
    const item = makeItem({
      homebranch: 'LIB_A',
      holding_library_id: 'LIB_B',
      checked_out_date: null
    })
    const result = analyzeBranchStatus(item)
    expect(result.needsTransfer).toBe(true)
  })

  it('returns needsTransfer false when branch mismatch but checked out', () => {
    const item = makeItem({
      homebranch: 'LIB_A',
      holding_library_id: 'LIB_B',
      checked_out_date: '2025-01-01'
    })
    const result = analyzeBranchStatus(item)
    expect(result.needsTransfer).toBe(false)
  })
})

describe('analyzeRestrictions', () => {
  it('returns isRestricted false when restricted_status is 0', () => {
    const item = makeItem({ restricted_status: '0' })
    const result = analyzeRestrictions(item)
    expect(result.isRestricted).toBe(false)
  })

  it('returns isRestricted true when restricted_status is not 0', () => {
    const item = makeItem({ restricted_status: '1' })
    const result = analyzeRestrictions(item)
    expect(result.isRestricted).toBe(true)
  })

  it('returns notForLoan false when not_for_loan_status is 0', () => {
    const item = makeItem({ not_for_loan_status: 0 })
    const result = analyzeRestrictions(item)
    expect(result.notForLoan).toBeFalsy()
  })

  it('returns notForLoan true when not_for_loan_status is not 0', () => {
    const item = makeItem({ not_for_loan_status: 1 })
    const result = analyzeRestrictions(item)
    expect(result.notForLoan).toBe(true)
  })
})

describe('analyzeItemStatus', () => {
  it('combines all status analyses', () => {
    const mockTransitInfo = { inTransit: false }
    const getTransitInfoFn = () => mockTransitInfo
    const item = makeItem({
      checked_out_date: '2025-01-01',
      lost_status: '1',
      withdrawn: '1'
    })

    const result = analyzeItemStatus(item, getTransitInfoFn)

    expect(result).toHaveProperty('checkout')
    expect(result).toHaveProperty('lost')
    expect(result).toHaveProperty('withdrawn')
    expect(result).toHaveProperty('damaged')
    expect(result).toHaveProperty('hold')
    expect(result).toHaveProperty('transit')
    expect(result).toHaveProperty('returnClaim')
    expect(result).toHaveProperty('branch')
    expect(result).toHaveProperty('restrictions')
    expect(result.transit).toEqual(mockTransitInfo)
  })

  it('calls getTransitInfoFn with item', () => {
    let capturedItem = null
    const getTransitInfoFn = (item) => {
      capturedItem = item
      return { inTransit: false }
    }
    const item = makeItem()

    analyzeItemStatus(item, getTransitInfoFn)

    expect(capturedItem).toEqual(item)
  })
})

describe('getProblematicStatuses', () => {
  function makeStatusAnalysis(overrides = {}) {
    return {
      checkout: { isOverdue: false, isCheckedOut: false },
      lost: { isLost: false, lostDescription: null },
      withdrawn: { isWithdrawn: false },
      damaged: { isDamaged: false },
      returnClaim: { hasReturnClaim: false },
      transit: { inTransit: false },
      branch: { hasBranchMismatch: false, needsTransfer: false },
      hold: { hasHold: false, isWaiting: false },
      ...overrides
    }
  }

  it('returns empty array when no issues', () => {
    const analysis = makeStatusAnalysis()
    const result = getProblematicStatuses(analysis)
    expect(result).toEqual([])
  })

  it('detects overdue items', () => {
    const analysis = makeStatusAnalysis({
      checkout: { isOverdue: true, isCheckedOut: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'overdue',
        severity: 'high'
      })
    )
  })

  it('detects lost items', () => {
    const analysis = makeStatusAnalysis({
      lost: { isLost: true, lostDescription: 'Lost' }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'lost',
        severity: 'high',
        message: 'Lost'
      })
    )
  })

  it('detects withdrawn items', () => {
    const analysis = makeStatusAnalysis({
      withdrawn: { isWithdrawn: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'withdrawn',
        severity: 'medium'
      })
    )
  })

  it('detects damaged items', () => {
    const analysis = makeStatusAnalysis({
      damaged: { isDamaged: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'damaged',
        severity: 'medium'
      })
    )
  })

  it('detects return claims', () => {
    const analysis = makeStatusAnalysis({
      returnClaim: { hasReturnClaim: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'return_claim',
        severity: 'high'
      })
    )
  })

  it('detects in-transit items', () => {
    const analysis = makeStatusAnalysis({
      transit: { inTransit: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'transit',
        severity: 'low'
      })
    )
  })

  it('detects branch mismatch when not checked out', () => {
    const analysis = makeStatusAnalysis({
      branch: { hasBranchMismatch: true, needsTransfer: true },
      checkout: { isCheckedOut: false }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'branch_mismatch',
        severity: 'medium'
      })
    )
  })

  it('ignores branch mismatch when checked out', () => {
    const analysis = makeStatusAnalysis({
      branch: { hasBranchMismatch: true },
      checkout: { isCheckedOut: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).not.toContainEqual(expect.objectContaining({ type: 'branch_mismatch' }))
  })

  it('detects waiting holds', () => {
    const analysis = makeStatusAnalysis({
      hold: { hasHold: true, isWaiting: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result).toContainEqual(
      expect.objectContaining({
        type: 'waiting_hold',
        severity: 'high'
      })
    )
  })

  it('sorts issues by severity (high > medium > low)', () => {
    const analysis = makeStatusAnalysis({
      checkout: { isOverdue: true, isCheckedOut: true },
      withdrawn: { isWithdrawn: true },
      transit: { inTransit: true }
    })
    const result = getProblematicStatuses(analysis)
    expect(result[0].severity).toBe('high')
    expect(result[1].severity).toBe('medium')
    expect(result[2].severity).toBe('low')
  })

  it('handles multiple high-severity issues', () => {
    const analysis = makeStatusAnalysis({
      checkout: { isOverdue: true, isCheckedOut: true },
      lost: { isLost: true, lostDescription: 'Lost' },
      returnClaim: { hasReturnClaim: true }
    })
    const result = getProblematicStatuses(analysis)
    const highSeverityIssues = result.filter((i) => i.severity === 'high')
    expect(highSeverityIssues).toHaveLength(3)
  })
})

describe('getLostDescription', () => {
  it('returns description for lost status 1', () => {
    expect(getLostDescription('1')).toBe('Lost')
  })

  it('returns description for lost status 2', () => {
    expect(getLostDescription('2')).toBe('Long Overdue (Lost)')
  })

  it('returns description for lost status 3', () => {
    expect(getLostDescription('3')).toBe('Lost and Paid For')
  })

  it('returns description for lost status 4', () => {
    expect(getLostDescription('4')).toBe('Missing')
  })

  it('returns generic description for unknown status', () => {
    expect(getLostDescription('99')).toBe('Lost Status: 99')
  })

  it('handles numeric input', () => {
    expect(getLostDescription(1)).toBe('Lost')
    expect(getLostDescription(2)).toBe('Long Overdue (Lost)')
  })
})
