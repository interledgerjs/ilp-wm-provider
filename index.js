const Koa = require('koa')
const router = require('koa-router')()
const app = new Koa()

// SSL settings
const WEB_PORT = Number(process.env.WEB_PORT) || 7771
const https = require('https')
const fs = require('fs')
const path = require('path')
const certOptions = {
  key: fs.readFileSync(path.resolve(__dirname, 'cert/server.key')),
  cert: fs.readFileSync(path.resolve(__dirname, 'cert/server.crt'))
}

router.get('/', async ctx => {
  ctx.body = 'Hello World'
})

app
  .use(router.routes())
  .use(router.allowedMethods())

const server = https
  .createServer(certOptions, app.callback())
  .listen(WEB_PORT)
