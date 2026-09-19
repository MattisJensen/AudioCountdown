(function exposeSpotifyControl(root) {
  const boundedVolume = value => Math.min(1, Math.max(0, Number(value)))

  function numericValue(value) {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }

  function rangeLimits(control) {
    const minimum = numericValue(control.min) ?? numericValue(control.getAttribute?.('aria-valuemin')) ?? 0
    const maximum = numericValue(control.max) ?? numericValue(control.getAttribute?.('aria-valuemax')) ?? 1
    return maximum > minimum ? { minimum, maximum } : null
  }

  function readRangeVolume(control) {
    if (!control) return null
    const limits = rangeLimits(control)
    const value = numericValue(control.value) ?? numericValue(control.getAttribute?.('aria-valuenow'))
    if (!limits || value === null) return null
    return boundedVolume((value - limits.minimum) / (limits.maximum - limits.minimum))
  }

  function writeRangeVolume(control, volume) {
    if (!control) return false
    const limits = rangeLimits(control)
    if (!limits) return false

    const value = limits.minimum + boundedVolume(volume) * (limits.maximum - limits.minimum)
    const valueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(control),
      'value',
    )?.set

    if (valueSetter) valueSetter.call(control, String(value))
    else control.value = String(value)

    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  function createSpotifyController({
    findPlayPauseButton,
    isPlaying,
    findVolumeControl = () => null,
    clickButton = button => button.click(),
    readVolume = readRangeVolume,
    writeVolume = writeRangeVolume,
    requestFrame = callback => requestAnimationFrame(callback),
    now = () => performance.now(),
    fadeDurationMs: defaultFadeDurationMs = 2000,
  }) {
    let pausedByController = false
    let savedVolume = null
    let activeFade = null

    function usableButton() {
      const button = findPlayPauseButton()
      return button && !button.disabled ? button : null
    }

    function currentVolume() {
      const volume = readVolume(findVolumeControl())
      return Number.isFinite(volume) ? volume : null
    }

    function synchronizePausedState() {
      if (pausedByController && usableButton() && isPlaying()) {
        pausedByController = false
        savedVolume = null
      }
    }

    function state(affectedCount, playingOverride) {
      const playing = playingOverride ?? Boolean(usableButton() && isPlaying())
      return {
        affectedCount,
        playingCount: playing ? 1 : 0,
        resumableCount: pausedByController ? 1 : 0,
        volume: savedVolume ?? currentVolume(),
      }
    }

    function cancelFade() {
      if (!activeFade) return null
      const fade = activeFade
      activeFade = null
      fade.resolve()
      return fade.targetVolume
    }

    function pause() {
      synchronizePausedState()
      const button = usableButton()
      if (!button || !isPlaying() || pausedByController) return state(0)

      const fadingTargetVolume = cancelFade()
      savedVolume = fadingTargetVolume ?? currentVolume()
      try {
        clickButton(button)
        pausedByController = true
        return state(1, false)
      } catch (_) {
        savedVolume = null
        return state(0)
      }
    }

    function fadeIn(targetVolume, fadeDurationMs) {
      if (fadeDurationMs <= 0 || targetVolume <= 0 || !findVolumeControl()) {
        writeVolume(findVolumeControl(), targetVolume)
        return Promise.resolve()
      }

      const startedAt = now()
      return new Promise(resolve => {
        const fade = { resolve, targetVolume }
        activeFade = fade
        const step = timestamp => {
          if (activeFade !== fade) return
          if (!isPlaying()) {
            activeFade = null
            writeVolume(findVolumeControl(), targetVolume)
            resolve()
            return
          }

          const progress = Math.min(1, (timestamp - startedAt) / fadeDurationMs)
          writeVolume(findVolumeControl(), targetVolume * progress)
          if (progress >= 1) {
            activeFade = null
            resolve()
          } else requestFrame(step)
        }
        requestFrame(step)
      })
    }

    async function resume(nextFadeDurationMs = defaultFadeDurationMs) {
      synchronizePausedState()
      const button = usableButton()
      if (!button || !pausedByController || isPlaying()) return state(0)

      const fadeDurationMs = Number.isFinite(nextFadeDurationMs)
        ? Math.min(60000, Math.max(0, nextFadeDurationMs))
        : defaultFadeDurationMs
      const targetVolume = savedVolume ?? currentVolume()
      if (Number.isFinite(targetVolume) && targetVolume > 0) {
        writeVolume(findVolumeControl(), 0)
      }

      try {
        clickButton(button)
        pausedByController = false
        savedVolume = null
        if (Number.isFinite(targetVolume)) await fadeIn(targetVolume, fadeDurationMs)
        return state(1, true)
      } catch (_) {
        if (Number.isFinite(targetVolume)) writeVolume(findVolumeControl(), targetVolume)
        return state(0)
      }
    }

    function setVolume(nextVolume) {
      synchronizePausedState()
      const volume = boundedVolume(nextVolume)
      cancelFade()
      if (pausedByController) savedVolume = volume
      const affectedCount = writeVolume(findVolumeControl(), volume) ? 1 : 0
      return state(affectedCount)
    }

    function status() {
      synchronizePausedState()
      return state(0)
    }

    return { pause, resume, 'set-volume': setVolume, status }
  }

  root.AudioCountdownSpotifyControl = {
    createSpotifyController,
    readRangeVolume,
    writeRangeVolume,
  }
})(globalThis)
