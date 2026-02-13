describe('Smoke Test', () => {
  it('should connect to the database via query task', () => {
    cy.task('query', 'SELECT COUNT(*) AS cnt FROM branches').then((rows) => {
      expect(rows[0].cnt).to.be.greaterThan(0)
    })
  })

  it('should login to Koha staff interface', () => {
    cy.login()
    cy.url().should('include', '/mainpage.pl')
    cy.contains('Koha').should('be.visible')
  })

  it('should create and clean up a sample biblio', () => {
    cy.task('insertSampleBiblio', { item_count: 1 }).then((result) => {
      expect(result.biblio_id).to.exist
      expect(result.items).to.have.length(1)
      expect(result.items[0].barcode).to.be.a('string')

      cy.task('deleteSampleObjects', {
        biblionumbers: [result.biblio_id]
      })
    })
  })

  it('should load the Interactive Inventory plugin', () => {
    cy.login()
    cy.visit(
      '/cgi-bin/koha/plugins/run.pl?class=Koha::Plugin::Com::InteractiveInventory&method=tool'
    )
    cy.contains('Interactive Inventory').should('be.visible')
    cy.get('#__app').should('exist')
    cy.get('button[type="submit"]').contains('Submit').should('be.visible')
  })
})
