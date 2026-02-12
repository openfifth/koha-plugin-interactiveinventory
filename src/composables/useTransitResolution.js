export function useTransitResolution() {
  function getTransitInfo(item) {
    if (!item.transfer) {
      return {
        inTransit: false,
        type: null,
        reason: null,
        isHoldTransit: false,
        isReturnTransit: false,
        isManualTransit: false,
        from: null,
        to: null,
        date: null
      }
    }

    const reason = item.transfer.reason
    const type = getTransitType(reason)

    return {
      inTransit: true,
      reason,
      type,
      from: item.transfer.frombranch,
      to: item.transfer.tobranch,
      date: item.transfer.datesent,
      isHoldTransit: reason === 'Reserve',
      isReturnTransit: ['ReturnToHome', 'ReturnToHolding'].includes(reason),
      isManualTransit: reason === 'Manual',
      isStockrotationTransit: ['StockrotationAdvance', 'StockrotationRepatriation'].includes(
        reason
      ),
      isCollectionTransit: reason === 'RotatingCollection',
      isRecallTransit: reason === 'Recall'
    }
  }

  function getTransitType(reason) {
    const typeMap = {
      Reserve: 'hold',
      ReturnToHome: 'return',
      ReturnToHolding: 'return',
      Manual: 'manual',
      StockrotationAdvance: 'stockrotation',
      StockrotationRepatriation: 'stockrotation',
      RotatingCollection: 'collection',
      Recall: 'recall',
      LostReserve: 'lost',
      CancelReserve: 'cancelled',
      RecallCancellation: 'cancelled'
    }
    return typeMap[reason] || 'other'
  }

  function getResolutionSettingKey(issueType) {
    const settingMap = {
      lost: 'resolveLostItems',
      withdrawn: 'resolveWithdrawnItems',
      transit: 'resolveInTransitItems',
      return_claim: 'resolveReturnClaims'
    }
    return settingMap[issueType]
  }

  function getModalType(issueType) {
    const modalMap = {
      lost: 'lost',
      withdrawn: 'withdrawn',
      transit: 'intransit',
      return_claim: 'returnclaim'
    }
    return modalMap[issueType]
  }

  async function handleItemIssue(
    item,
    issue,
    statusAnalysis,
    resolutionSettings,
    openResolutionModalFn
  ) {
    const resolutionKey = getResolutionSettingKey(issue.type)
    const shouldAutoResolve = resolutionKey && resolutionSettings[resolutionKey]

    if (!shouldAutoResolve) {
      const modalType = getModalType(issue.type)
      if (modalType) {
        openResolutionModalFn(item, modalType)
        return true
      }
    }

    return false
  }

  return {
    getTransitInfo,
    getTransitType,
    getResolutionSettingKey,
    getModalType,
    handleItemIssue
  }
}
