function spotifyIsPlaying() {
  const mediaSessionState = navigator.mediaSession?.playbackState
  if (mediaSessionState === 'playing') return true
  if (mediaSessionState === 'paused') return false
  return document.title.includes(' • ')
}

const controller = location.hostname === 'open.spotify.com'
  ? globalThis.AudioCountdownSpotifyControl.createSpotifyController({
    findPlayPauseButton: () => document.querySelector('[data-testid="control-button-playpause"]'),
    findVolumeControl: () => document.querySelector('[data-testid="volume-bar"] input[type="range"]'),
    isPlaying: spotifyIsPlaying,
  })
  : globalThis.AudioCountdownMediaControl.createMediaController({
    findMedia: () => document.querySelectorAll('audio, video'),
  })

browser.runtime.onMessage.addListener(message => {
  if (message?.type !== 'audio-countdown-media-command') return undefined

  const action = controller[message.command]
  if (typeof action !== 'function') return undefined

  const argument = message.command === 'set-volume' ? message.volume : message.fadeDurationMs
  return Promise.resolve(action(argument)).then(result => ({ ok: true, ...result }))
})
