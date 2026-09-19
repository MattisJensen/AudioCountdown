const assert = require('node:assert/strict')
const { before, test } = require('node:test')

let createSpotifyController
let readRangeVolume
let writeRangeVolume

before(() => {
  require('./spotify-control.js')
  ;({ createSpotifyController, readRangeVolume, writeRangeVolume } = globalThis.AudioCountdownSpotifyControl)
})

function spotifyController({ playing = true, volume: initialVolume = 0.7 } = {}) {
  let isCurrentlyPlaying = playing
  let volume = initialVolume
  const button = {
    disabled: false,
    click() { isCurrentlyPlaying = !isCurrentlyPlaying },
  }
  const volumeControl = {}
  const controller = createSpotifyController({
    findPlayPauseButton: () => button,
    isPlaying: () => isCurrentlyPlaying,
    findVolumeControl: () => volumeControl,
    readVolume: () => volume,
    writeVolume: (_, nextVolume) => { volume = nextVolume; return true },
    fadeDurationMs: 0,
  })

  return {
    controller,
    isPlaying: () => isCurrentlyPlaying,
    volume: () => volume,
    clickPlayPause: () => button.click(),
  }
}

test('pauses Spotify through its play/pause control', () => {
  const spotify = spotifyController({ volume: 0.65 })

  const result = spotify.controller.pause()

  assert.equal(spotify.isPlaying(), false)
  assert.deepEqual(result, { affectedCount: 1, playingCount: 0, resumableCount: 1, volume: 0.65 })
})

test('resumes only Spotify playback stopped by the controller', async () => {
  const spotify = spotifyController()
  spotify.controller.pause()

  const result = await spotify.controller.resume()

  assert.equal(spotify.isPlaying(), true)
  assert.deepEqual(result, { affectedCount: 1, playingCount: 1, resumableCount: 0, volume: 0.7 })
})

test('does not pause or resume playback that was already paused', async () => {
  const spotify = spotifyController({ playing: false })

  const pauseResult = spotify.controller.pause()
  const resumeResult = await spotify.controller.resume()

  assert.equal(spotify.isPlaying(), false)
  assert.equal(pauseResult.affectedCount, 0)
  assert.equal(resumeResult.affectedCount, 0)
})

test('does not resume Spotify after the user resumes it manually', async () => {
  const spotify = spotifyController()
  spotify.controller.pause()
  spotify.clickPlayPause()

  const result = await spotify.controller.resume()

  assert.equal(spotify.isPlaying(), true)
  assert.deepEqual(result, { affectedCount: 0, playingCount: 1, resumableCount: 0, volume: 0.7 })
})

test('updates Spotify volume and the saved resume volume', async () => {
  const spotify = spotifyController({ volume: 0.8 })
  spotify.controller.pause()

  const result = spotify.controller['set-volume'](0.25)
  await spotify.controller.resume()

  assert.equal(spotify.volume(), 0.25)
  assert.deepEqual(result, { affectedCount: 1, playingCount: 0, resumableCount: 1, volume: 0.25 })
})

test('fades Spotify back to its saved volume when resuming', async () => {
  let playing = true
  let volume = 0.6
  let currentTime = 0
  const frames = []
  const button = { disabled: false, click() { playing = !playing } }
  const controller = createSpotifyController({
    findPlayPauseButton: () => button,
    isPlaying: () => playing,
    findVolumeControl: () => ({}),
    readVolume: () => volume,
    writeVolume: (_, nextVolume) => { volume = nextVolume; return true },
    requestFrame: callback => frames.push(callback),
    now: () => currentTime,
  })
  controller.pause()

  const resume = controller.resume(1000)
  await Promise.resolve()
  currentTime = 500
  frames.shift()(currentTime)
  assert.equal(volume, 0.3)
  currentTime = 1000
  frames.shift()(currentTime)
  await resume

  assert.equal(volume, 0.6)
})

test('reads and writes Spotify range controls with arbitrary limits', () => {
  const events = []
  const prototype = {
    get value() { return this.currentValue },
    set value(nextValue) { this.currentValue = nextValue },
  }
  const control = Object.assign(Object.create(prototype), {
    min: '0',
    max: '100',
    currentValue: '40',
    dispatchEvent(event) { events.push(event.type) },
  })

  assert.equal(readRangeVolume(control), 0.4)
  assert.equal(writeRangeVolume(control, 0.75), true)
  assert.equal(control.currentValue, '75')
  assert.deepEqual(events, ['input', 'change'])
})
