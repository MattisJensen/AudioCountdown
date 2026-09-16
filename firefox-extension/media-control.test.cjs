const assert = require('node:assert/strict')
const { before, test } = require('node:test')

let createMediaController

before(() => {
  require('./media-control.js')
  createMediaController = globalThis.AudioCountdownMediaControl.createMediaController
})

function mediaElement({ playing = true, volume = 0.7 } = {}) {
  return {
    paused: !playing,
    ended: false,
    isConnected: true,
    muted: false,
    volume,
    pause() { this.paused = true },
    play() { this.paused = false; return Promise.resolve() },
  }
}

function controllerFor(media) {
  return createMediaController({
    findMedia: () => media,
    fadeDurationMs: 0,
  })
}

test('pauses only media that is currently playing', () => {
  const playing = mediaElement()
  const alreadyPaused = mediaElement({ playing: false })
  const controller = controllerFor([playing, alreadyPaused])

  const result = controller.pause()

  assert.equal(playing.paused, true)
  assert.equal(alreadyPaused.paused, true)
  assert.deepEqual(result, { affectedCount: 1, playingCount: 0, resumableCount: 1 })
})

test('resumes only media previously paused by the controller', async () => {
  const playing = mediaElement({ volume: 0.45 })
  const alreadyPaused = mediaElement({ playing: false })
  const controller = controllerFor([playing, alreadyPaused])
  controller.pause()

  const result = await controller.resume()

  assert.equal(playing.paused, false)
  assert.equal(playing.volume, 0.45)
  assert.equal(alreadyPaused.paused, true)
  assert.deepEqual(result, { affectedCount: 1, playingCount: 1, resumableCount: 0 })
})

test('does not take control again after the user resumes media manually', async () => {
  const playing = mediaElement()
  const controller = controllerFor([playing])
  controller.pause()
  await playing.play()

  const result = await controller.resume()

  assert.deepEqual(result, { affectedCount: 0, playingCount: 1, resumableCount: 0 })
})

test('preserves the original target volume when paused during a fade', async () => {
  const playing = mediaElement({ volume: 0.6 })
  const frames = []
  let currentTime = 0
  const controller = createMediaController({
    findMedia: () => [playing],
    fadeDurationMs: 1000,
    now: () => currentTime,
    requestFrame: callback => frames.push(callback),
  })
  controller.pause()

  const firstResume = controller.resume()
  await Promise.resolve()
  currentTime = 400
  frames.shift()(currentTime)
  assert.equal(playing.volume, 0.24)

  controller.pause()
  await firstResume
  assert.equal(playing.paused, true)

  const secondResume = controller.resume()
  await Promise.resolve()
  currentTime = 1400
  frames.pop()(currentTime)
  await secondResume
  assert.equal(playing.volume, 0.6)
})
