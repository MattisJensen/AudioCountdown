const controller = globalThis.AudioCountdownMediaControl.createMediaController({
  findMedia: () => document.querySelectorAll('audio, video'),
})

browser.runtime.onMessage.addListener(message => {
  if (message?.type !== 'audio-countdown-media-command') return undefined

  const action = controller[message.command]
  if (typeof action !== 'function') return undefined

  return Promise.resolve(action(message.volume)).then(result => ({ ok: true, ...result }))
})
