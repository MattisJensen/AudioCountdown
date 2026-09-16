const PAGE_MESSAGE_SOURCE = 'audio-countdown-page'
const EXTENSION_MESSAGE_SOURCE = 'audio-countdown-extension'
const COMMANDS = new Set(['pause', 'resume', 'set-volume', 'status'])

window.addEventListener('message', async event => {
  if (event.source !== window
      || event.origin !== window.location.origin
      || event.data?.source !== PAGE_MESSAGE_SOURCE
      || typeof event.data.requestId !== 'string'
      || !COMMANDS.has(event.data.command)) {
    return
  }

  let response
  try {
    response = await browser.runtime.sendMessage({
      type: 'audio-countdown-command',
      command: event.data.command,
      volume: event.data.volume,
      fadeDurationMs: event.data.fadeDurationMs,
    })
  } catch (_) {
    response = { ok: false }
  }

  window.postMessage({
    source: EXTENSION_MESSAGE_SOURCE,
    requestId: event.data.requestId,
    response,
  }, window.location.origin)
})
