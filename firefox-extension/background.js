const PROVIDER_URLS = [
  'https://music.apple.com/*',
  'https://open.spotify.com/*',
  'https://*.youtube.com/*',
  'https://soundcloud.com/*',
]

const COMMANDS = new Set(['pause', 'resume', 'status'])
const LOCAL_PORTS = new Set(['3000', '5173'])

function isAllowedSender(sender) {
  try {
    const url = new URL(sender.url)
    return url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      && LOCAL_PORTS.has(url.port)
  } catch (_) {
    return false
  }
}

async function sendToProviderTab(tabId, command) {
  try {
    return await browser.tabs.sendMessage(tabId, {
      type: 'audio-countdown-media-command',
      command,
    })
  } catch (_) {
    return null
  }
}

async function controlProviderTabs(command) {
  const tabs = await browser.tabs.query({ url: PROVIDER_URLS })
  const responses = await Promise.all(tabs.map(tab => sendToProviderTab(tab.id, command)))
  const validResponses = responses.filter(response => response?.ok)

  return {
    ok: true,
    command,
    providerTabCount: validResponses.length,
    affectedCount: validResponses.reduce((total, response) => total + response.affectedCount, 0),
    playingCount: validResponses.reduce((total, response) => total + response.playingCount, 0),
    resumableCount: validResponses.reduce((total, response) => total + response.resumableCount, 0),
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!isAllowedSender(sender)
      || message?.type !== 'audio-countdown-command'
      || !COMMANDS.has(message.command)) {
    return undefined
  }

  return controlProviderTabs(message.command)
})
