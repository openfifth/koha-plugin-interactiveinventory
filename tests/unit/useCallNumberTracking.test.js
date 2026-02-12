import { describe, it, expect } from 'vitest'
import { useCallNumberTracking } from '../../src/composables/useCallNumberTracking'

describe('useCallNumberTracking', () => {
  it('initializes refs with correct default values', () => {
    const { highestCallNumberSort, itemWithHighestCallNumber, biblioWithHighestCallNumber } =
      useCallNumberTracking()

    expect(highestCallNumberSort.value).toBe('')
    expect(itemWithHighestCallNumber.value).toBe('')
    expect(biblioWithHighestCallNumber.value).toBeNull()
  })

  it('returns all required methods', () => {
    const composable = useCallNumberTracking()
    expect(typeof composable.isCallNumberOutOfOrder).toBe('function')
    expect(typeof composable.checkItemStatuses).toBe('function')
    expect(typeof composable.updateHighestCallNumber).toBe('function')
  })

  describe('isCallNumberOutOfOrder', () => {
    const { isCallNumberOutOfOrder } = useCallNumberTracking()

    it('returns false when currentCallNumberSort is empty', () => {
      expect(isCallNumberOutOfOrder('', '100')).toBe(false)
      expect(isCallNumberOutOfOrder(null, '100')).toBe(false)
      expect(isCallNumberOutOfOrder(undefined, '100')).toBe(false)
    })

    it('returns false when highest is empty', () => {
      expect(isCallNumberOutOfOrder('100', '')).toBe(false)
      expect(isCallNumberOutOfOrder('100', null)).toBe(false)
      expect(isCallNumberOutOfOrder('100', undefined)).toBe(false)
    })

    it('returns false when both are empty', () => {
      expect(isCallNumberOutOfOrder('', '')).toBe(false)
      expect(isCallNumberOutOfOrder(null, null)).toBe(false)
    })

    it('returns false when current is greater than or equal to highest', () => {
      expect(isCallNumberOutOfOrder('200', '100')).toBe(false)
      expect(isCallNumberOutOfOrder('100', '100')).toBe(false)
    })

    it('returns true when current is less than highest', () => {
      expect(isCallNumberOutOfOrder('050', '100')).toBe(true)
      expect(isCallNumberOutOfOrder('099', '100')).toBe(true)
    })

    it('handles string comparison correctly', () => {
      expect(isCallNumberOutOfOrder('A', 'B')).toBe(true)
      expect(isCallNumberOutOfOrder('B', 'A')).toBe(false)
      expect(isCallNumberOutOfOrder('ABC', 'ABD')).toBe(true)
    })
  })

  describe('checkItemStatuses', () => {
    const { checkItemStatuses } = useCallNumberTracking()

    it('initializes invalidStatus object on item', () => {
      const item = {
        lost_status: '0',
        not_for_loan_status: '0',
        withdrawn: '0',
        damaged_status: '0'
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus).toEqual({})
    })

    it('marks item with invalid lost status', () => {
      const item = {
        lost_status: '1',
        not_for_loan_status: '0',
        withdrawn: '0',
        damaged_status: '0'
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus.key).toBe('items.itemlost')
      expect(item.invalidStatus.value).toBe('1')
    })

    it('marks item with invalid not_for_loan status', () => {
      const item = {
        lost_status: '0',
        not_for_loan_status: '1',
        withdrawn: '0',
        damaged_status: '0'
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus.key).toBe('items.notforloan')
      expect(item.invalidStatus.value).toBe('1')
    })

    it('marks item with invalid withdrawn status', () => {
      const item = {
        lost_status: '0',
        not_for_loan_status: '0',
        withdrawn: '1',
        damaged_status: '0'
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus.key).toBe('items.withdrawn')
      expect(item.invalidStatus.value).toBe('1')
    })

    it('marks item with invalid damaged status', () => {
      const item = {
        lost_status: '0',
        not_for_loan_status: '0',
        withdrawn: '0',
        damaged_status: '1'
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus.key).toBe('items.damaged')
      expect(item.invalidStatus.value).toBe('1')
    })

    it('stops at first invalid status found', () => {
      const item = {
        lost_status: '1',
        not_for_loan_status: '1',
        withdrawn: '1',
        damaged_status: '1'
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus.key).toBe('items.itemlost')
      expect(item.invalidStatus.value).toBe('1')
    })

    it('accepts items with selected status values', () => {
      const item = {
        lost_status: '1',
        not_for_loan_status: '0',
        withdrawn: '0',
        damaged_status: '0'
      }
      const selectedStatuses = {
        'items.itemlost': ['0', '1'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus).toEqual({})
    })

    it('handles numeric status values', () => {
      const item = {
        lost_status: 1,
        not_for_loan_status: 0,
        withdrawn: 0,
        damaged_status: 0
      }
      const selectedStatuses = {
        'items.itemlost': ['0'],
        'items.notforloan': ['0'],
        'items.withdrawn': ['0'],
        'items.damaged': ['0']
      }

      checkItemStatuses(item, selectedStatuses)
      expect(item.invalidStatus.key).toBe('items.itemlost')
    })
  })

  describe('updateHighestCallNumber', () => {
    it('does nothing with empty items array', () => {
      const { updateHighestCallNumber, highestCallNumberSort, itemWithHighestCallNumber } =
        useCallNumberTracking()

      updateHighestCallNumber([])

      expect(highestCallNumberSort.value).toBe('')
      expect(itemWithHighestCallNumber.value).toBe('')
    })

    it('updates refs with single item', () => {
      const {
        updateHighestCallNumber,
        highestCallNumberSort,
        itemWithHighestCallNumber,
        biblioWithHighestCallNumber
      } = useCallNumberTracking()

      const items = [
        {
          call_number_sort: '100',
          external_id: 'ITEM001',
          biblio_id: 'BIB001'
        }
      ]

      updateHighestCallNumber(items)

      expect(highestCallNumberSort.value).toBe('100')
      expect(itemWithHighestCallNumber.value).toBe('ITEM001')
      expect(biblioWithHighestCallNumber.value).toBe('BIB001')
    })

    it('finds highest call number from multiple items', () => {
      const { updateHighestCallNumber, highestCallNumberSort, itemWithHighestCallNumber } =
        useCallNumberTracking()

      const items = [
        { call_number_sort: '100', external_id: 'ITEM001', biblio_id: 'BIB001' },
        { call_number_sort: '300', external_id: 'ITEM003', biblio_id: 'BIB003' },
        { call_number_sort: '200', external_id: 'ITEM002', biblio_id: 'BIB002' }
      ]

      updateHighestCallNumber(items)

      expect(highestCallNumberSort.value).toBe('300')
      expect(itemWithHighestCallNumber.value).toBe('ITEM003')
    })

    it('ignores items without call_number_sort', () => {
      const { updateHighestCallNumber, highestCallNumberSort, itemWithHighestCallNumber } =
        useCallNumberTracking()

      const items = [
        { call_number_sort: '', external_id: 'ITEM001', biblio_id: 'BIB001' },
        { call_number_sort: '200', external_id: 'ITEM002', biblio_id: 'BIB002' },
        { call_number_sort: null, external_id: 'ITEM003', biblio_id: 'BIB003' }
      ]

      updateHighestCallNumber(items)

      expect(highestCallNumberSort.value).toBe('200')
      expect(itemWithHighestCallNumber.value).toBe('ITEM002')
    })

    it('handles items with missing biblio_id', () => {
      const { updateHighestCallNumber, biblioWithHighestCallNumber } = useCallNumberTracking()

      const items = [{ call_number_sort: '100', external_id: 'ITEM001', biblio_id: null }]

      updateHighestCallNumber(items)

      expect(biblioWithHighestCallNumber.value).toBeNull()
    })

    it('updates biblioWithHighestCallNumber correctly', () => {
      const { updateHighestCallNumber, biblioWithHighestCallNumber } = useCallNumberTracking()

      const items = [
        { call_number_sort: '100', external_id: 'ITEM001', biblio_id: 'BIB001' },
        { call_number_sort: '200', external_id: 'ITEM002', biblio_id: 'BIB002' }
      ]

      updateHighestCallNumber(items)

      expect(biblioWithHighestCallNumber.value).toBe('BIB002')
    })

    it('handles string call numbers correctly', () => {
      const { updateHighestCallNumber, highestCallNumberSort } = useCallNumberTracking()

      const items = [
        { call_number_sort: 'A', external_id: 'ITEM001', biblio_id: 'BIB001' },
        { call_number_sort: 'Z', external_id: 'ITEM002', biblio_id: 'BIB002' },
        { call_number_sort: 'M', external_id: 'ITEM003', biblio_id: 'BIB003' }
      ]

      updateHighestCallNumber(items)

      expect(highestCallNumberSort.value).toBe('Z')
    })

    it('can be called multiple times and updates refs', () => {
      const { updateHighestCallNumber, highestCallNumberSort, itemWithHighestCallNumber } =
        useCallNumberTracking()

      const items1 = [{ call_number_sort: '100', external_id: 'ITEM001', biblio_id: 'BIB001' }]
      updateHighestCallNumber(items1)
      expect(highestCallNumberSort.value).toBe('100')

      const items2 = [
        { call_number_sort: '100', external_id: 'ITEM001', biblio_id: 'BIB001' },
        { call_number_sort: '500', external_id: 'ITEM005', biblio_id: 'BIB005' }
      ]
      updateHighestCallNumber(items2)
      expect(highestCallNumberSort.value).toBe('500')
      expect(itemWithHighestCallNumber.value).toBe('ITEM005')
    })

    it('handles items with undefined call_number_sort', () => {
      const { updateHighestCallNumber, highestCallNumberSort } = useCallNumberTracking()

      const items = [
        { call_number_sort: undefined, external_id: 'ITEM001', biblio_id: 'BIB001' },
        { call_number_sort: '200', external_id: 'ITEM002', biblio_id: 'BIB002' }
      ]

      updateHighestCallNumber(items)

      expect(highestCallNumberSort.value).toBe('200')
    })
  })

  describe('reactivity', () => {
    it('refs are reactive and can be modified', () => {
      const { highestCallNumberSort, itemWithHighestCallNumber, biblioWithHighestCallNumber } =
        useCallNumberTracking()

      highestCallNumberSort.value = '100'
      expect(highestCallNumberSort.value).toBe('100')

      itemWithHighestCallNumber.value = 'ITEM001'
      expect(itemWithHighestCallNumber.value).toBe('ITEM001')

      biblioWithHighestCallNumber.value = 'BIB001'
      expect(biblioWithHighestCallNumber.value).toBe('BIB001')
    })

    it('multiple instances have independent state', () => {
      const instance1 = useCallNumberTracking()
      const instance2 = useCallNumberTracking()

      instance1.highestCallNumberSort.value = '100'
      instance2.highestCallNumberSort.value = '200'

      expect(instance1.highestCallNumberSort.value).toBe('100')
      expect(instance2.highestCallNumberSort.value).toBe('200')
    })
  })
})
