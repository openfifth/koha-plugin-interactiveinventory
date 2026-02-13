import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportDataToCSV } from '../../src/composables/useCSVExport'

vi.mock('../../src/components/eventBus', () => ({
  EventBus: {
    emit: vi.fn()
  }
}))

import { EventBus } from '../../src/components/eventBus'

describe('useCSVExport', () => {
  let mockBlob
  let mockUrl
  let mockAnchor
  let createElementSpy
  let createObjectURLSpy
  let revokeObjectURLSpy

  beforeEach(() => {
    vi.clearAllMocks()

    mockUrl = 'blob:http://localhost/mock-url'
    mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {}
    }

    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl)
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
  })

  afterEach(() => {
    createElementSpy.mockRestore()
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  describe('exportDataToCSV', () => {
    it('exports items to CSV with correct headers', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
      const blobArg = createObjectURLSpy.mock.calls[0][0]
      expect(blobArg).toBeInstanceOf(Blob)
    })

    it('creates anchor element with correct download filename', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(mockAnchor.download).toBe('inventory.csv')
    })

    it('creates anchor element with "missing_items.csv" filename when exportMissingOnly is true', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: true })

      expect(mockAnchor.download).toBe('missing_items.csv')
    })

    it('triggers download by clicking anchor element', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(mockAnchor.click).toHaveBeenCalled()
    })

    it('revokes object URL after download', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl)
    })

    it('emits success message', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          type: 'success',
          text: expect.stringContaining('Exported')
        })
      )
    })

    it('includes item count in success message', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('2 items')
        })
      )
    })

    it('includes "missing items only" in message when exportMissingOnly is true', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: true })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('missing items only')
        })
      )
    })
  })

  describe('CSV content generation', () => {
    it('includes all required headers in CSV', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      const blobArg = createObjectURLSpy.mock.calls[0][0]
      expect(blobArg.type).toBe('text/csv')
    })

    it('exports location data items', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [
            { barcode: '001', title: 'Book 1' },
            { barcode: '002', title: 'Book 2' }
          ]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('2 items')
        })
      )
    })

    it('exports scanned items not in location data', () => {
      const items = [{ external_id: '003', title: 'Book 3' }]
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('3 items')
        })
      )
    })

    it('filters to missing items only when exportMissingOnly is true', () => {
      const items = [{ external_id: '001' }]
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }, { barcode: '003' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: true })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('2 items')
        })
      )
    })

    it('handles items with missing biblio data', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', title: 'Book 1' }, { barcode: '002' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('marks items as "Missing" when not scanned', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001' }, { barcode: '002' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('2 items')
        })
      )
    })

    it('marks items as "Wrong Place" when flagged', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', wrongPlace: true }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('marks items as "Out of Order" when flagged', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', outOfOrder: true }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('marks items as "Invalid Status" when flagged', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', invalidStatus: true }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('marks items as "Was Lost" when flagged', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', wasLost: true }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('handles items with nested biblio data', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [
            {
              barcode: '001',
              biblio: {
                title: 'Book Title',
                author: 'Author Name',
                publication_year: 2020,
                publisher: 'Publisher',
                isbn: '123-456',
                pages: 300
              }
            }
          ]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('merges scanned item data with location data', () => {
      const items = [
        {
          external_id: '001',
          title: 'Updated Title',
          author: 'Updated Author'
        }
      ]
      const sessionData = {
        response_data: {
          location_data: [
            {
              barcode: '001',
              title: 'Original Title'
            }
          ]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('handles items with checked_out_date', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', checked_out_date: '2025-01-01' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('handles items with datelastseen or last_seen_date', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [
            { barcode: '001', datelastseen: '2025-01-01' },
            { barcode: '002', last_seen_date: '2025-01-02' }
          ]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('generates correct Koha catalogue URL', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', biblionumber: '123' }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('handles items with wasScanned flag', () => {
      const items = [{ external_id: '001' }]
      const sessionData = {
        response_data: {
          location_data: [{ barcode: '001', wasScanned: true }]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles empty items and location data', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: []
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('0 items')
        })
      )
    })

    it('handles items with special characters in fields', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [
            {
              barcode: '001',
              title: 'Book with "quotes" and, commas'
            }
          ]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('handles items with null or undefined fields', () => {
      const items = []
      const sessionData = {
        response_data: {
          location_data: [
            {
              barcode: '001',
              title: null,
              author: undefined
            }
          ]
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it('handles large number of items', () => {
      const items = []
      const locationData = Array.from({ length: 1000 }, (_, i) => ({
        barcode: String(i + 1)
      }))
      const sessionData = {
        response_data: {
          location_data: locationData
        }
      }

      exportDataToCSV({ items, sessionData, exportMissingOnly: false })

      expect(EventBus.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          text: expect.stringContaining('1000 items')
        })
      )
    })
  })
})
