const { defineConfig } = require('cypress')
const path = require('path')

const kohaRoot = process.env.KOHA_ROOT || path.resolve(__dirname, '../../../koha')
const kohaPlugins = path.join(kohaRoot, 't/cypress/plugins')

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.js',
    baseUrl: process.env.KOHA_INTRANET_URL || 'http://localhost:8081',
    supportFile: 'cypress/support/e2e.js',
    defaultCommandTimeout: 10000,
    env: {
      apiUsername: process.env.KOHA_USER || 'koha',
      apiPassword: process.env.KOHA_PASS || 'koha'
    },
    setupNodeEvents(on, config) {
      const { query } = require(path.join(kohaPlugins, 'db.js'))
      const { getBasicAuthHeader } = require(path.join(kohaPlugins, 'auth.js'))
      const { buildSampleObject, buildSampleObjects } = require(
        path.join(kohaPlugins, 'mockData.js')
      )
      const {
        insertSampleBiblio,
        insertSampleHold,
        insertSampleCheckout,
        insertSamplePatron,
        insertObject,
        deleteSampleObjects
      } = require(path.join(kohaPlugins, 'insertData.js'))
      const { apiGet, apiPost, apiPut, apiDelete } = require(
        path.join(kohaPlugins, 'api-client.js')
      )

      const baseUrl = config.baseUrl
      const authHeader = getBasicAuthHeader(config.env.apiUsername, config.env.apiPassword)

      on('task', {
        getBasicAuthHeader() {
          return getBasicAuthHeader(config.env.apiUsername, config.env.apiPassword)
        },
        buildSampleObject,
        buildSampleObjects,
        insertSampleBiblio(args) {
          return insertSampleBiblio({ ...args, baseUrl, authHeader })
        },
        insertSampleHold(args) {
          return insertSampleHold({ ...args, baseUrl, authHeader })
        },
        insertSampleCheckout(args) {
          return insertSampleCheckout({ ...args, baseUrl, authHeader })
        },
        insertSamplePatron(args) {
          return insertSamplePatron({ ...args, baseUrl, authHeader })
        },
        insertObject(args) {
          return insertObject({ ...args, baseUrl, authHeader })
        },
        deleteSampleObjects,
        query,
        apiGet(args) {
          return apiGet({ ...args, baseUrl, authHeader })
        },
        apiPost(args) {
          return apiPost({ ...args, baseUrl, authHeader })
        },
        apiPut(args) {
          return apiPut({ ...args, baseUrl, authHeader })
        },
        apiDelete(args) {
          return apiDelete({ ...args, baseUrl, authHeader })
        }
      })

      return config
    }
  }
})
