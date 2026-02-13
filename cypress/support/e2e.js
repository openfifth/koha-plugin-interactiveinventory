import './commands'

function get_fallback_login_value(param) {
  const env_var = param === 'username' ? 'apiUsername' : 'apiPassword'
  return typeof Cypress.env(env_var) === 'undefined' ? 'koha' : Cypress.env(env_var)
}

Cypress.Commands.add('login', (username, password) => {
  const user = typeof username === 'undefined' ? get_fallback_login_value('username') : username
  const pass = typeof password === 'undefined' ? get_fallback_login_value('password') : password
  cy.visit('/cgi-bin/koha/mainpage.pl?logout.x=1')
  cy.get('#userid').type(user)
  cy.get('#password').type(pass)
  cy.get('#submit-button').click()
})
