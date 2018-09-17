const Koa = require('koa')
const router = require('koa-router')()
const app = new Koa()
const debug = require('debug')('ilp-ws-provider')
const ws = require('ws')
const httpProxy = require('http-proxy')

const Connector = require('ilp-connector')
const PluginBtp = require('ilp-plugin-btp')
const crypto = require('crypto')
const ILDCP = require('ilp-protocol-ildcp')

// SSL settings
const WS_PORT = Number(process.env.WS_PORT) || 7772
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
  ctx.set('Content-Type', 'text/html')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'static/handler.html'))
})

router.get('/', async ctx => {
  ctx.set('Content-Type', 'text/html')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'static/index.html'))
})

router.get('/polyfill.js', async ctx => {
  ctx.set('Content-Type', 'text/js')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'dist/polyfill.js'))
})

router.get('/handler.js', async ctx => {
  ctx.set('Content-Type', 'text/js')
  ctx.body = await fs.readFile(path.resolve(__dirname, 'dist/handler.js'))
})

app
  .use(router.routes())
  .use(router.allowedMethods())

debug('listening on', WEB_PORT)
const server = https
  .createServer(certOptions, app.callback())
  .listen(WEB_PORT)

const proxy = httpProxy.createProxyServer()
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, {
    target: 'http://localhost:' + WS_PORT
  })
})

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
  const connector = Connector.createApp({
    spread: 0,
    backend: 'one-to-one',
    store: 'ilp-store-memory',
    initialConnectTimeout: 60000,
    env: ildcp.clientAddress.startsWith('g.') ? 'production' : 'test',
    accounts: {
      wm: {
        relation: 'child',
        plugin: 'ilp-plugin-mini-accounts',
        assetCode: ildcp.assetCode,
        assetScale: (ildcp.assetCode === 'XRP' ? 9 : ildcp.assetScale),
        maxPacketAmount: '100000',
        throughput: {
          incomingAmount: process.env.THROUGHPUT || '100000'
        },
        options: {
          wsOpts: { host: 'localhost', port: WS_PORT },
          allowedOrigins: [ 'https://localhost:' + WEB_PORT ]
        }
      },
      moneyd: {
        relation: 'parent',
        plugin: 'ilp-plugin-btp',
        assetCode: ildcp.assetCode,
        assetScale: ildcp.assetScale,
        sendRoutes: false,
        receiveRoutes: false,
        throughput: {
          outgoingAmount: process.env.THROUGHPUT || '100'
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
