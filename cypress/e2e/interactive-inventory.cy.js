const pluginUrl =
  '/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=tool'

describe('Interactive Inventory Plugin', () => {
  beforeEach(() => {
    cy.login()
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
    cy.get('button[type="submit"]').contains('Submit').should('be.visible')
  })

  it('should load libraries into the dropdown', () => {
    cy.visit(pluginUrl)
    cy.get('#library').should('exist')
    cy.get('#library option').should('have.length.greaterThan', 1)
  })

  it('should load item types', () => {
    cy.visit(pluginUrl)
    cy.get('.item-types-grid', { timeout: 10000 })
      .find('.item-type-box')
      .should('have.length.greaterThan', 0)
  })

  it('should have default parameter values', () => {
    cy.visit(pluginUrl)
    cy.get('#inventoryDate').should('have.value', new Date().toISOString().split('T')[0])
    cy.get('#compareBarcodes').should('not.be.checked')
    cy.get('#skipCheckedOutItems').should('be.checked')
  })

  describe('Session Setup and Scanning', () => {
    let biblio
    let barcode

    before(() => {
      cy.login()
      cy.task('insertSampleBiblio', { item_count: 1 }).then((result) => {
        biblio = result
        barcode = result.items[0].barcode
      })
    })

    after(() => {
      if (biblio) {
        cy.task('deleteSampleObjects', {
          biblionumbers: [biblio.biblio_id]
        })
      }
    })

    it('should start an inventory session', () => {
      cy.visit(pluginUrl)

      cy.get('#library', { timeout: 10000 }).find('option').should('have.length.greaterThan', 1)

      cy.get('button[type="submit"]').click()

      cy.get('#__app', { timeout: 10000 }).then(($app) => {
        const hasScanner =
          $app.find('input[type="text"]').length > 0 ||
          $app.find('[class*="barcode"]').length > 0 ||
          $app.text().includes('Scan') ||
          $app.text().includes('barcode')
        expect(hasScanner).to.be.true
      })
    })

    it('should scan a barcode and display the item', () => {
      cy.visit(pluginUrl)

      cy.get('#library', { timeout: 10000 }).find('option').should('have.length.greaterThan', 1)

      cy.get('button[type="submit"]').click()

      cy.get('input[type="text"]', { timeout: 10000 })
        .first()
        .should('be.visible')
        .type(`${barcode}{enter}`)

      cy.contains(barcode, { timeout: 10000 }).should('be.visible')
    })
  })

  describe('Plugin API Endpoints', () => {
    let biblio
    let barcode

    before(() => {
      cy.login()
      cy.task('insertSampleBiblio', { item_count: 1 }).then((result) => {
        biblio = result
        barcode = result.items[0].barcode
      })
    })

    after(() => {
      if (biblio) {
        cy.task('deleteSampleObjects', {
          biblionumbers: [biblio.biblio_id]
        })
      }
    })

    it('should serve the static JS bundle', () => {
      cy.request('/api/v1/contrib/interactiveinventory/static/dist/interactiveinventory.js').then(
        (response) => {
          expect(response.status).to.eq(200)
          expect(response.headers['content-type']).to.include('javascript')
        }
      )
    })

    it('should modify an item field via the API', () => {
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

    it('should modify multiple item fields via bulk API', () => {
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
  })

  describe('Resolution Settings', () => {
    it('should toggle resolution checkboxes', () => {
      cy.visit(pluginUrl)

      cy.get('#resolveLostItems').should('not.be.checked').check()
      cy.get('#resolveLostItems').should('be.checked')

      cy.get('#resolveReturnClaims').should('not.be.checked').check()
      cy.get('#resolveReturnClaims').should('be.checked')

      cy.get('#resolveInTransitItems').should('not.be.checked').check()
      cy.get('#resolveInTransitItems').should('be.checked')

      cy.get('#resolveWithdrawnItems').should('not.be.checked').check()
      cy.get('#resolveWithdrawnItems').should('be.checked')
    })

    it('should toggle alert checkboxes', () => {
      cy.visit(pluginUrl)

      cy.get('#showWithdrawnAlerts').should('be.checked').uncheck()
      cy.get('#showWithdrawnAlerts').should('not.be.checked')

      cy.get('#showOnHoldAlerts').should('be.checked').uncheck()
      cy.get('#showOnHoldAlerts').should('not.be.checked')
    })
  })
})
