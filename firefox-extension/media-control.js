(function exposeMediaControl(root) {
  function createMediaController({
    findMedia,
    requestFrame = callback => requestAnimationFrame(callback),
    now = () => performance.now(),
    fadeDurationMs = 2000,
  }) {
    const pausedMedia = new Map()
    const activeFades = new Map()

    const mediaElements = () => Array.from(findMedia())
    const isPlaying = media => !media.paused && !media.ended

    function purgeStaleMedia() {
      for (const media of pausedMedia.keys()) {
        if (!media.isConnected || !media.paused) pausedMedia.delete(media)
      }
    }

    function counts() {
      purgeStaleMedia()
      return {
        playingCount: mediaElements().filter(isPlaying).length,
        resumableCount: pausedMedia.size,
      }
    }

    function currentVolume() {
      purgeStaleMedia()
      const savedState = pausedMedia.values().next().value
      if (savedState && Number.isFinite(savedState.volume)) return savedState.volume

      const media = mediaElements().find(isPlaying) ?? mediaElements()[0]
      return Number.isFinite(media?.volume) ? media.volume : null
    }

    function state(affectedCount) {
      return { affectedCount, ...counts(), volume: currentVolume() }
    }

    function cancelFade(media) {
      const fade = activeFades.get(media)
      if (!fade) return null
      activeFades.delete(media)
      fade.resolve()
      return fade.targetVolume
    }

    function pause() {
      let affectedCount = 0
      for (const media of mediaElements()) {
        if (!isPlaying(media) || pausedMedia.has(media)) continue

        try {
          const fadingTargetVolume = cancelFade(media)
          pausedMedia.set(media, { volume: fadingTargetVolume ?? media.volume })
          media.pause()
          affectedCount += 1
        } catch (_) {
          pausedMedia.delete(media)
        }
      }

      return state(affectedCount)
    }

    function fadeIn(media, targetVolume) {
      if (fadeDurationMs <= 0 || media.muted || targetVolume <= 0) {
        media.volume = targetVolume
        return Promise.resolve()
      }

      const startedAt = now()
      return new Promise(resolve => {
        const fade = { resolve, targetVolume }
        activeFades.set(media, fade)
        const step = timestamp => {
          if (activeFades.get(media) !== fade) return
          if (media.paused) {
            activeFades.delete(media)
            media.volume = targetVolume
            resolve()
            return
          }

          const progress = Math.min(1, (timestamp - startedAt) / fadeDurationMs)
          media.volume = targetVolume * progress
          if (progress >= 1) {
            activeFades.delete(media)
            resolve()
          }
          else requestFrame(step)
        }
        requestFrame(step)
      })
    }

    async function resumeOne(media, savedState) {
      if (!media.isConnected || !media.paused) {
        pausedMedia.delete(media)
        return false
      }

      const targetVolume = savedState.volume
      if (!media.muted && targetVolume > 0) media.volume = 0

      try {
        await Promise.resolve(media.play())
        pausedMedia.delete(media)
        await fadeIn(media, targetVolume)
        return true
      } catch (_) {
        media.volume = targetVolume
        return false
      }
    }

    async function resume() {
      purgeStaleMedia()
      const results = await Promise.all(
        Array.from(pausedMedia.entries(), ([media, savedState]) => resumeOne(media, savedState)),
      )
      return state(results.filter(Boolean).length)
    }

    function setVolume(nextVolume) {
      const volume = Math.min(1, Math.max(0, Number(nextVolume)))
      let affectedCount = 0

      for (const media of mediaElements()) {
        try {
          cancelFade(media)
          media.volume = volume
          affectedCount += 1
        } catch (_) {}
      }
      for (const savedState of pausedMedia.values()) savedState.volume = volume

      return state(affectedCount)
    }

    return {
      pause,
      resume,
      'set-volume': setVolume,
      status: () => state(0),
    }
  }

  root.AudioCountdownMediaControl = { createMediaController }
})(globalThis)
