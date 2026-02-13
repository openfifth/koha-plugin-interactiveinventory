const pluginUrl =
  '/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=tool'

describe('Interactive Inventory Plugin', () => {
  beforeEach(() => {
    cy.login()
    cy.title().should('eq', 'Koha staff interface')
  })

  it('should load the plugin page', () => {
    cy.visit(pluginUrl)
    cy.contains('Interactive Inventory').should('be.visible')
    cy.get('#__app').should('exist')
  })

  it('should display the setup form with all sections', () => {
    cy.visit(pluginUrl)
    cy.contains('h2', 'Parameters').should('be.visible')
    cy.contains('h2', 'Item Location Filters').should('be.visible')
    cy.contains('h2', 'Status Alerts').should('be.visible')
    cy.contains('h2', 'Status Resolution').should('be.visible')
    cy.contains('h2', 'Preview Settings').should('be.visible')
    cy.get('#__app button[type="submit"]').contains('Submit').should('be.visible')
  })

  describe('Parameters Section', () => {
    it('should have correct default values for all parameters', () => {
      cy.visit(pluginUrl)
      cy.get('#inventoryDate').should('have.value', new Date().toISOString().split('T')[0])
      cy.get('#compareBarcodes').should('not.be.checked')
      cy.get('#doNotCheckIn').should('not.be.checked')
      cy.get('#checkShelvedOutOfOrder').should('not.be.checked')
    })

    it('should toggle compareBarcodes and show help text', () => {
      cy.visit(pluginUrl)
      cy.get('#compareBarcodes').check()
      cy.get('#compareBarcodes').should('be.checked')
      cy.contains('checked against the expected items list').should('be.visible')
      cy.get('#compareBarcodes').uncheck()
      cy.contains('without comparison').should('be.visible')
    })

    it('should toggle doNotCheckIn', () => {
      cy.visit(pluginUrl)
      cy.get('#doNotCheckIn').should('not.be.checked').check()
      cy.get('#doNotCheckIn').should('be.checked')
    })

    it('should toggle checkShelvedOutOfOrder', () => {
      cy.visit(pluginUrl)
      cy.get('#checkShelvedOutOfOrder').should('not.be.checked').check()
      cy.get('#checkShelvedOutOfOrder').should('be.checked')
    })

    it('should allow changing the inventory date', () => {
      cy.visit(pluginUrl)
      cy.get('#inventoryDate').clear().type('2025-06-15')
      cy.get('#inventoryDate').should('have.value', '2025-06-15')
    })
  })

  describe('Item Location Filters', () => {
    it('should load and allow selecting a library', () => {
      cy.visit(pluginUrl)
      cy.get('#library', { timeout: 10000 }).find('option').should('have.length.greaterThan', 1)
      cy.get('#library').select(1)
      cy.get('#library').invoke('val').should('not.be.empty')
    })

    it('should load shelving locations', () => {
      cy.visit(pluginUrl)
      cy.get('#shelvingLocation', { timeout: 10000 }).should('exist')
      cy.get('#shelvingLocation option').should('have.length.greaterThan', 0)
    })

    it('should load collection codes', () => {
      cy.visit(pluginUrl)
      cy.get('#collectionCode', { timeout: 10000 }).should('exist')
      cy.get('#collectionCode option').should('have.length.greaterThan', 0)
    })

    it('should accept call number range inputs', () => {
      cy.visit(pluginUrl)
      cy.get('#minlocation').type('100')
      cy.get('#minlocation').should('have.value', '100')
      cy.get('#maxlocation').type('500')
      cy.get('#maxlocation').should('have.value', '500')
    })

    it('should have a classification scheme selector', () => {
      cy.visit(pluginUrl)
      cy.get('#class_source').should('exist')
      cy.get('#class_source option').should('have.length.greaterThan', 0)
    })
  })

  describe('Optional Filters', () => {
    it('should load status filter groups (LOST, NOT_LOAN, WITHDRAWN, DAMAGED)', () => {
      cy.visit(pluginUrl)
      cy.get('#statuses', { timeout: 10000 }).should('exist')
      cy.get('#statuses .status-column').should('have.length', 4)
    })

    it('should allow selecting status filters', () => {
      cy.visit(pluginUrl)
      cy.get('#statuses .status-column', { timeout: 10000 })
        .first()
        .within(() => {
          cy.get('input[type="checkbox"]').first().check()
          cy.get('input[type="checkbox"]').first().should('be.checked')
        })
    })

    it('should have correct defaults for skip/filter checkboxes', () => {
      cy.visit(pluginUrl)
      cy.get('#ignoreWaitingHolds').should('not.be.checked')
      cy.get('#skipCheckedOutItems').should('be.checked')
      cy.get('#skipInTransitItems').should('not.be.checked')
      cy.get('#skipBranchMismatchItems').should('not.be.checked')
    })

    it('should toggle ignoreWaitingHolds', () => {
      cy.visit(pluginUrl)
      cy.get('#ignoreWaitingHolds').check()
      cy.get('#ignoreWaitingHolds').should('be.checked')
    })

    it('should toggle skipCheckedOutItems', () => {
      cy.visit(pluginUrl)
      cy.get('#skipCheckedOutItems').should('be.checked').uncheck()
      cy.get('#skipCheckedOutItems').should('not.be.checked')
    })

    it('should toggle skipInTransitItems', () => {
      cy.visit(pluginUrl)
      cy.get('#skipInTransitItems').check()
      cy.get('#skipInTransitItems').should('be.checked')
    })

    it('should toggle skipBranchMismatchItems', () => {
      cy.visit(pluginUrl)
      cy.get('#skipBranchMismatchItems').check()
      cy.get('#skipBranchMismatchItems').should('be.checked')
    })

    it('should allow setting a last inventory date', () => {
      cy.visit(pluginUrl)
      cy.get('#datelastseen').type('2025-01-01')
      cy.get('#datelastseen').should('have.value', '2025-01-01')
    })

    it('should load item types and allow selection', () => {
      cy.visit(pluginUrl)
      cy.get('.item-types-grid', { timeout: 10000 })
        .find('.checkbox-option')
        .should('have.length.greaterThan', 0)
      cy.get('.item-types-grid .checkbox-option').first().click()
      cy.get('.item-types-grid .checkbox-option')
        .first()
        .find('input[type="checkbox"]')
        .should('be.checked')
    })
  })

  describe('Status Alerts', () => {
    it('should have all alert checkboxes checked by default', () => {
      cy.visit(pluginUrl)
      cy.get('#showWithdrawnAlerts').should('be.checked')
      cy.get('#showOnHoldAlerts').should('be.checked')
      cy.get('#showInTransitAlerts').should('be.checked')
      cy.get('#showBranchMismatchAlerts').should('be.checked')
      cy.get('#showReturnClaimAlerts').should('be.checked')
    })

    it('should toggle showWithdrawnAlerts', () => {
      cy.visit(pluginUrl)
      cy.get('#showWithdrawnAlerts').uncheck()
      cy.get('#showWithdrawnAlerts').should('not.be.checked')
    })

    it('should toggle showOnHoldAlerts', () => {
      cy.visit(pluginUrl)
      cy.get('#showOnHoldAlerts').uncheck()
      cy.get('#showOnHoldAlerts').should('not.be.checked')
    })

    it('should toggle showInTransitAlerts', () => {
      cy.visit(pluginUrl)
      cy.get('#showInTransitAlerts').uncheck()
      cy.get('#showInTransitAlerts').should('not.be.checked')
    })

    it('should toggle showBranchMismatchAlerts', () => {
      cy.visit(pluginUrl)
      cy.get('#showBranchMismatchAlerts').uncheck()
      cy.get('#showBranchMismatchAlerts').should('not.be.checked')
    })

    it('should toggle showReturnClaimAlerts', () => {
      cy.visit(pluginUrl)
      cy.get('#showReturnClaimAlerts').uncheck()
      cy.get('#showReturnClaimAlerts').should('not.be.checked')
    })
  })

  describe('Status Resolution', () => {
    it('should have correct resolution defaults', () => {
      cy.visit(pluginUrl)
      cy.get('#enableManualResolution').should('be.checked')
      cy.get('#resolveLostItems').should('not.be.checked')
      cy.get('#resolveReturnClaims').should('not.be.checked')
      cy.get('#resolveInTransitItems').should('not.be.checked')
      cy.get('#resolveWithdrawnItems').should('not.be.checked')
    })

    it('should toggle enableManualResolution', () => {
      cy.visit(pluginUrl)
      cy.get('#enableManualResolution').uncheck()
      cy.get('#enableManualResolution').should('not.be.checked')
    })

    it('should toggle resolveLostItems', () => {
      cy.visit(pluginUrl)
      cy.get('#resolveLostItems').check()
      cy.get('#resolveLostItems').should('be.checked')
    })

    it('should toggle resolveReturnClaims', () => {
      cy.visit(pluginUrl)
      cy.get('#resolveReturnClaims').check()
      cy.get('#resolveReturnClaims').should('be.checked')
    })

    it('should toggle resolveInTransitItems', () => {
      cy.visit(pluginUrl)
      cy.get('#resolveInTransitItems').check()
      cy.get('#resolveInTransitItems').should('be.checked')
    })

    it('should toggle resolveWithdrawnItems', () => {
      cy.visit(pluginUrl)
      cy.get('#resolveWithdrawnItems').check()
      cy.get('#resolveWithdrawnItems').should('be.checked')
    })
  })

  describe('Preview Settings', () => {
    it('should have correct preview defaults', () => {
      cy.visit(pluginUrl)
      cy.get('#enableShelfPreview').should('be.checked')
      cy.get('#showItemIssues').should('be.checked')
      cy.get('#autoOpenPreview').should('not.be.checked')
    })

    it('should toggle enableShelfPreview', () => {
      cy.visit(pluginUrl)
      cy.get('#enableShelfPreview').uncheck()
      cy.get('#enableShelfPreview').should('not.be.checked')
    })

    it('should toggle showItemIssues', () => {
      cy.visit(pluginUrl)
      cy.get('#showItemIssues').uncheck()
      cy.get('#showItemIssues').should('not.be.checked')
    })

    it('should toggle autoOpenPreview', () => {
      cy.visit(pluginUrl)
      cy.get('#autoOpenPreview').check()
      cy.get('#autoOpenPreview').should('be.checked')
    })
  })

  describe('Session Data Propagation', () => {
    it('should pass all form values to the session start request', () => {
      cy.visit(pluginUrl)

      cy.intercept('GET', '**/run.pl?*method=tool*action=start_session*').as('startSession')

      cy.get('#inventoryDate').clear().type('2025-06-15')
      cy.get('#compareBarcodes').check()
      cy.get('#doNotCheckIn').check()
      cy.get('#checkShelvedOutOfOrder').check()
      cy.get('#skipCheckedOutItems').uncheck()
      cy.get('#skipInTransitItems').check()
      cy.get('#skipBranchMismatchItems').check()
      cy.get('#ignoreWaitingHolds').check()
      cy.get('#showWithdrawnAlerts').uncheck()
      cy.get('#showOnHoldAlerts').uncheck()
      cy.get('#resolveLostItems').check()
      cy.get('#resolveReturnClaims').check()
      cy.get('#enableShelfPreview').uncheck()
      cy.get('#autoOpenPreview').check()

      cy.get('#minlocation').type('100')
      cy.get('#maxlocation').type('999')

      cy.on('window:confirm', () => true)

      cy.get('#__app button[type="submit"]').click()

      cy.wait('@startSession').then((interception) => {
        const url = new URL(interception.request.url)
        const sessionData = JSON.parse(decodeURIComponent(url.searchParams.get('session_data')))

        expect(sessionData.inventoryDate).to.eq('2025-06-15')
        expect(sessionData.compareBarcodes).to.eq(true)
        expect(sessionData.doNotCheckIn).to.eq(true)
        expect(sessionData.checkShelvedOutOfOrder).to.eq(true)
        expect(sessionData.skipCheckedOutItems).to.eq(false)
        expect(sessionData.skipInTransitItems).to.eq(true)
        expect(sessionData.skipBranchMismatchItems).to.eq(true)
        expect(sessionData.ignoreWaitingHolds).to.eq(true)
        expect(sessionData.minLocation).to.eq('100')
        expect(sessionData.maxLocation).to.eq('999')

        expect(sessionData.alertSettings.showWithdrawnAlerts).to.eq(false)
        expect(sessionData.alertSettings.showOnHoldAlerts).to.eq(false)
        expect(sessionData.alertSettings.showInTransitAlerts).to.eq(true)
        expect(sessionData.alertSettings.showBranchMismatchAlerts).to.eq(true)
        expect(sessionData.alertSettings.showReturnClaimAlerts).to.eq(true)

        expect(sessionData.resolutionSettings.resolveLostItems).to.eq(true)
        expect(sessionData.resolutionSettings.resolveReturnClaims).to.eq(true)
        expect(sessionData.resolutionSettings.resolveInTransitItems).to.eq(false)
        expect(sessionData.resolutionSettings.resolveWithdrawnItems).to.eq(false)
        expect(sessionData.resolutionSettings.enableManualResolution).to.eq(true)

        expect(sessionData.previewSettings.enableShelfPreview).to.eq(false)
        expect(sessionData.previewSettings.showItemIssues).to.eq(true)
        expect(sessionData.previewSettings.autoOpenPreview).to.eq(true)
      })
    })
  })
})

describe('Interactive Inventory Session', () => {
  beforeEach(function () {
    cy.login()
    cy.title().should('eq', 'Koha staff interface')
    cy.task('insertSampleBiblio', { item_count: 1 }).then((objects) => {
      cy.wrap(objects).as('objects')
    })
  })

  afterEach(function () {
    cy.task('deleteSampleObjects', [this.objects])
  })

  it('should start an inventory session', function () {
    cy.visit(pluginUrl)
    cy.get('#__app #library', { timeout: 10000 })
      .find('option')
      .should('have.length.greaterThan', 1)
    cy.get('#__app button[type="submit"]').click()
    cy.get('#barcode_input', { timeout: 10000 }).should('be.visible')
  })

  it('should scan a barcode and display the item', function () {
    const barcode = this.objects.items[0].external_id
    cy.visit(pluginUrl)
    cy.get('#__app #library', { timeout: 10000 })
      .find('option')
      .should('have.length.greaterThan', 1)
    cy.get('#__app button[type="submit"]').click()
    cy.get('#barcode_input', { timeout: 10000 }).should('be.visible').type(`${barcode}{enter}`)
    cy.contains(barcode, { timeout: 10000 }).should('be.visible')
  })
})

describe('Interactive Inventory API Endpoints', () => {
  beforeEach(function () {
    cy.login()
    cy.title().should('eq', 'Koha staff interface')
    cy.task('insertSampleBiblio', { item_count: 1 }).then((objects) => {
      cy.wrap(objects).as('objects')
    })
  })

  afterEach(function () {
    cy.task('deleteSampleObjects', [this.objects])
  })

  it('should serve the static JS bundle', () => {
    cy.request('/api/v1/contrib/interactiveinventory/static/dist/interactiveinventory.js').then(
      (response) => {
        expect(response.status).to.eq(200)
        expect(response.headers['content-type']).to.include('javascript')
      }
    )
  })

  it('should modify an item field via the API', function () {
    const barcode = this.objects.items[0].external_id
    cy.task('getBasicAuthHeader').then((authHeader) => {
      cy.request({
        method: 'POST',
        url: '/api/v1/contrib/interactiveinventory/item/field',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: {
          barcode: barcode,
          fields: { datelastseen: new Date().toISOString().split('T')[0] }
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.exist
      })
    })
  })

  it('should return 400 for missing barcode on item field', () => {
    cy.task('getBasicAuthHeader').then((authHeader) => {
      cy.request({
        method: 'POST',
        url: '/api/v1/contrib/interactiveinventory/item/field',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: { fields: { datelastseen: '2025-01-01' } },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })
  })

  it('should return 404 for nonexistent barcode', () => {
    cy.task('getBasicAuthHeader').then((authHeader) => {
      cy.request({
        method: 'POST',
        url: '/api/v1/contrib/interactiveinventory/item/field',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: {
          barcode: 'NONEXISTENT_BARCODE_XYZ_999999',
          fields: { datelastseen: '2025-01-01' }
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404)
      })
    })
  })

  it('should modify multiple item fields via bulk API', function () {
    const barcode = this.objects.items[0].external_id
    cy.task('getBasicAuthHeader').then((authHeader) => {
      cy.request({
        method: 'POST',
        url: '/api/v1/contrib/interactiveinventory/item/fields',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: {
          items: [
            {
              barcode: barcode,
              fields: {
                datelastseen: new Date().toISOString().split('T')[0]
              }
            }
          ]
        }
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.results).to.be.an('array')
        expect(response.body.results[0].success).to.exist
      })
    })
  })

  it('should return 400 for missing items on bulk API', () => {
    cy.task('getBasicAuthHeader').then((authHeader) => {
      cy.request({
        method: 'POST',
        url: '/api/v1/contrib/interactiveinventory/item/fields',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: {},
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })
  })

  describe('Check-in API', () => {
    it('should check in an item', function () {
      const barcode = this.objects.items[0].external_id
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/checkin',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: {
            barcode: barcode,
            date: new Date().toISOString().split('T')[0]
          }
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.exist
        })
      })
    })

    it('should return 400 for missing barcode on check-in', () => {
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/checkin',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: { date: '2026-01-01' },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(400)
        })
      })
    })

    it('should return 404 for nonexistent barcode on check-in', () => {
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/checkin',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: {
            barcode: 'NONEXISTENT_BARCODE_XYZ_999999',
            date: '2026-01-01'
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(404)
        })
      })
    })
  })

  describe('Renew API', () => {
    it('should return 400 for missing barcode on renew', () => {
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/renew',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: {},
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(400)
        })
      })
    })

    it('should return 404 for item not checked out on renew', function () {
      const barcode = this.objects.items[0].external_id
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/renew',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: { barcode: barcode },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([404, 403])
        })
      })
    })
  })

  describe('Resolve Transit API', () => {
    it('should return 400 for missing barcode on resolve transit', () => {
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/resolve_transit',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: {},
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(400)
        })
      })
    })

    it('should return 404 for item not in transit', function () {
      const barcode = this.objects.items[0].external_id
      cy.task('getBasicAuthHeader').then((authHeader) => {
        cy.request({
          method: 'POST',
          url: '/api/v1/contrib/interactiveinventory/item/resolve_transit',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          body: { barcode: barcode },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(404)
        })
      })
    })
  })
})

describe('Interactive Inventory Session Lifecycle', () => {
  beforeEach(function () {
    cy.login()
    cy.title().should('eq', 'Koha staff interface')
    cy.task('insertSampleBiblio', { item_count: 1 }).then((objects) => {
      cy.wrap(objects).as('objects')
    })
  })

  afterEach(function () {
    cy.task('deleteSampleObjects', [this.objects])
  })

  it('should end an inventory session', function () {
    cy.visit(pluginUrl)
    cy.get('#__app #library', { timeout: 10000 })
      .find('option')
      .should('have.length.greaterThan', 1)
    cy.get('#__app button[type="submit"]').click()
    cy.get('#barcode_input', { timeout: 10000 }).should('be.visible')

    cy.get('.end-session-button', { timeout: 10000 }).should('be.visible').click()
    cy.get('.end-session-modal-button', { timeout: 10000 }).should('be.visible').click()

    cy.get('#library', { timeout: 10000 }).should('be.visible')
  })

  it('should scan an item then end session', function () {
    const barcode = this.objects.items[0].external_id
    cy.visit(pluginUrl)
    cy.get('#__app #library', { timeout: 10000 })
      .find('option')
      .should('have.length.greaterThan', 1)
    cy.get('#__app button[type="submit"]').click()
    cy.get('#barcode_input', { timeout: 10000 }).should('be.visible').type(`${barcode}{enter}`)
    cy.contains(barcode, { timeout: 10000 }).should('be.visible')

    cy.get('.end-session-button').click()
    cy.get('.end-session-modal-button').click()

    cy.get('#library', { timeout: 10000 }).should('be.visible')
  })

  it('should select a specific library for the session', function () {
    cy.visit(pluginUrl)
    cy.get('#__app #library', { timeout: 10000 })
      .find('option')
      .should('have.length.greaterThan', 1)

    cy.get('#__app #library').select(1)
    cy.get('#__app #library').invoke('val').should('not.be.empty')

    cy.get('#__app button[type="submit"]').click()
    cy.get('#barcode_input', { timeout: 10000 }).should('be.visible')
  })
})
