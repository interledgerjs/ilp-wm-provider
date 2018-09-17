const crypto = require('crypto')
const Plugin = require('ilp-plugin-btp')

const secret = crypto.randomBytes(16).toString('hex')
const host = window.location.host
const server = 'btp+wss://:' + secret + '@' + host

const plugin = new Plugin({ server })
const EventEmitter = require('events')
const rpcEvents = new EventEmitter()

const WEB_MONETIZATION_DOMAIN = 'https://polyfill.webmonetization.org'

async function handleRequest (data) {
  const id = data.id
  const packet = Buffer.from(data.request, 'base64')

  if (document.hidden) {
    window.parent.postMessage({
      id,
      error: 'background page cannot send money'
    }, WEB_MONETIZATION_DOMAIN)
  }

  try {
    if (!plugin.isConnected()) {
      await new Promise(resolve => {
        let timer
        const listener = () => {
          clearTimeout(timer)
          resolve()
        }

        timer = setTimeout(() => {
          plugin.removeEventListener(listener)
          reject(new Error('plugin is not connected'))
        }, 5000)

        plugin.once('connect', listener)
      })
    }

    const response = await plugin.sendData(packet)
    window.parent.postMessage({
      id,
      response: response.toString('base64')
    }, WEB_MONETIZATION_DOMAIN)
  } catch (e) {
    console.error('error sending packet.', e)
    window.parent.postMessage({
      id,
      error: e.message 
    }, WEB_MONETIZATION_DOMAIN)
  }
}

function handleResponse (data) {
  const id = data.id
  rpcEvents.emit(id, data)
}

function receiveMessage (ev) {
  const { data, origin } = ev
  const id = data.id

  if (ev.origin !== WEB_MONETIZATION_DOMAIN) {
    console.error('got message from unexpected origin.' +
      ' got=' + ev.origin +
      ' expected=' + WEB_MONETIZATION_DOMAIN)
    return
  }

  if (data.request) {
    return handleRequest(data)
  } else if (data.response || data.error) {
    return handleResponse(data)
  } else {
    window.parent.postMessage({
      id,
      error: 'invalid rpc command'
    }, WEB_MONETIZATION_DOMAIN)
  }
}

async function sendMessage (buffer) {
  const id = crypto.randomBytes(16).toString('hex')
  const response = new Promise((resolve, reject) => {
    rpcEvents.once(id, data => {
      if (data.response) resolve(Buffer.from(data.response, 'base64'))
      else if (data.error) reject(new Error(data.error))
    })
  })

  window.parent.postMessage({
    id,
    request: buffer.toString('base64')
  }, WEB_MONETIZATION_DOMAIN)

  return response
}

async function load () {
  window.addEventListener('message', receiveMessage, false)

  const params = new URLSearchParams(window.location.search)
  const parentOrigin = params.get('origin')

  await plugin.connect()
  plugin.registerDataHandler(sendMessage)
}

window.addEventListener('load', load)
