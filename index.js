const Koa = require('koa')
const router = require('koa-router')()
const app = new Koa()
const debug = require('debug')('ilp-ws-provider')

const Connector = require('ilp-connector')()
const PluginBtp = require('ilp-plugin-btp')()
const crypto = require('crypto')
const ILDCP = require('ilp-protocol-ildcp')

// SSL settings
const WEB_PORT = Number(process.env.WEB_PORT) || 7771
const https = require('https')
const fs = require('fs-extra')
const path = require('path')

debug('loading SSL cert')
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname, 'cert/server.key')),
  cert: fs.readFileSync(path.resolve(__dirname, 'cert/server.crt'))
}

router.get('/handler.html', async ctx => {
  ctx.body = fs.readFile(path.resolve(__dirname, 'static/handler.html'))
})

router.get('/polyfill.js', async ctx => {
  ctx.body = fs.readFile(path.resolve(__dirname, 'dist/polyfill.js'))
})

router.get('/handler.js', async ctx => {
  ctx.body = fs.readFile(path.resolve(__dirname, 'dist/handler.js'))
})

app
  .use(router.routes())
  .use(router.allowedMethods())

debug('listening on', WEB_PORT)
const server = https
  .createServer(certOptions, app.callback())
  .listen(WEB_PORT)

async function start () {
  const moneydUri = process.env.MONEYD_URI || 'btp+ws://localhost:7768'
  const btpToken = crypto.randomBytes(16).toString('hex')
  const plugin = new PluginBtp({
    server: moneydUri,
    btpToken
  })

  debug('connecting plugin. server=' + moneydUri)
  await plugin.connect()

  debug('ILDCP lookup on plugin.')
  const ildcp = await ILDCP.fetch(plugin.sendData.bind(plugin))

  debug('got ILDCP result. res=' + JSON.stringify(ildcp))
  const connectorBtpToken = crypto.randomBytes(16).toString('hex')
  const WS_PORT = Number(process.env.WS_PORT) || 7772
  const connector = Connector.createApp({
    spread: 0,
    backend: 'one-to-one',
    store: 'memdown',
    initialConnectTimeout: 60000,
    env: ildcp.startsWith('g.') ? 'production' : 'test',
    accounts: {
      wm: {
        relation: 'child',
        plugin: 'ilp-plugin-btp',
        assetCode: ildcp.assetCode,
        assetScale: ildcp.assetScale,
        throughput: {
          outgoing: process.env.THROUGHPUT || '100'
        },
        options: {
          wsOpts: { host: 'localhost', port: WS_PORT },
          allowedOrigins: [ 'https://localhost:' + WS_PORT ]
        }
      },
      moneyd: {
        relation: 'parent',
        plugin: 'ilp-plugin-btp',
        assetCode: ildcp.assetCode,
        assetScale: ildcp.assetScale,
        throughput: {
          outgoing: process.env.THROUGHPUT || '100'
        },
        options: {
          server: moneydUri,
          btpToken: connectorBtpToken
        }
      }
    }
  })

  connector.listen()
}

start()
  .catch(e => {
    console.error(e)
    process.env(1)
  })
