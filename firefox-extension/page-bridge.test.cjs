const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')

let messageListener
let postedMessage
let runtimeMessageCount = 0

before(() => {
  global.window = {
    location: { origin: 'http://localhost:3000' },
    addEventListener(type, listener) {
      if (type === 'message') messageListener = listener
    },
    postMessage(message, targetOrigin) {
      postedMessage = { message, targetOrigin }
    },
  }
  global.browser = {
    runtime: {
      sendMessage() {
        runtimeMessageCount += 1
        return Promise.resolve({ ok: true })
      },
    },
  }
  require('./page-bridge.js')
})

after(() => {
  delete global.window
  delete global.browser
})

test('answers health checks without waiting for the extension background or provider tabs', async () => {
  await messageListener({
    source: global.window,
    origin: global.window.location.origin,
    data: {
      source: 'audio-countdown-page',
      requestId: 'health-check',
      command: 'ping',
    },
  })

  assert.equal(runtimeMessageCount, 0)
  assert.deepEqual(postedMessage, {
    message: {
      source: 'audio-countdown-extension',
      requestId: 'health-check',
      response: { ok: true, command: 'ping' },
    },
    targetOrigin: 'http://localhost:3000',
  })
})
