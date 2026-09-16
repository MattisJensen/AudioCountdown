import { useCallback, useEffect, useRef, useState } from 'react'
import { trackContentUrl } from './api.js'

export function useAudioPlayer(onError) {
  const playerRef = useRef(null)
  if (playerRef.current === null) {
    playerRef.current = new Audio()
    playerRef.current.preload = 'metadata'
  }

  const [trackId, setTrackId] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const player = playerRef.current
    const updateTime = () => setCurrentTime(player.currentTime || 0)
    const updateDuration = () => setDuration(Number.isFinite(player.duration) ? player.duration : 0)
    const markPlaying = () => setIsPlaying(true)
    const markPaused = () => setIsPlaying(false)
    const markEnded = () => {
      setIsPlaying(false)
      setCurrentTime(Number.isFinite(player.duration) ? player.duration : 0)
    }
    player.addEventListener('timeupdate', updateTime)
    player.addEventListener('loadedmetadata', updateDuration)
    player.addEventListener('durationchange', updateDuration)
    player.addEventListener('play', markPlaying)
    player.addEventListener('pause', markPaused)
    player.addEventListener('ended', markEnded)
    return () => {
      player.pause()
      player.removeEventListener('timeupdate', updateTime)
      player.removeEventListener('loadedmetadata', updateDuration)
      player.removeEventListener('durationchange', updateDuration)
      player.removeEventListener('play', markPlaying)
      player.removeEventListener('pause', markPaused)
      player.removeEventListener('ended', markEnded)
    }
  }, [])

  const useSource = useCallback((nextTrackId) => {
    const player = playerRef.current
    if (player.dataset.trackId === nextTrackId) return false
    player.pause()
    player.dataset.trackId = nextTrackId
    player.src = trackContentUrl(nextTrackId)
    player.load()
    return true
  }, [])

  const prime = useCallback((nextTrackId) => {
    const player = playerRef.current
    useSource(nextTrackId)
    player.muted = true
    player.play()
      .then(() => {
        player.pause()
        player.currentTime = 0
      })
      .catch(() => {})
      .finally(() => { player.muted = false })
  }, [useSource])

  const playTrack = useCallback((nextTrackId) => {
    const player = playerRef.current
    const sourceChanged = useSource(nextTrackId)
    player.currentTime = 0
    setTrackId(nextTrackId)
    setCurrentTime(0)
    setDuration(sourceChanged ? 0 : (Number.isFinite(player.duration) ? player.duration : 0))
    player.play().catch(() => onError('The browser blocked audio playback. Use the player to start the audio.'))
  }, [onError, useSource])

  const toggle = useCallback(() => {
    const player = playerRef.current
    if (player.paused) {
      if (Number.isFinite(player.duration) && player.currentTime >= player.duration) player.currentTime = 0
      player.play().catch(() => onError('The browser blocked audio playback. Please try again.'))
    } else {
      player.pause()
    }
  }, [onError])

  const seek = useCallback((nextTime) => {
    const player = playerRef.current
    if (!Number.isFinite(player.duration) || player.duration <= 0) return
    const boundedTime = Math.min(Math.max(Number(nextTime), 0), player.duration)
    player.currentTime = boundedTime
    setCurrentTime(boundedTime)
  }, [])

  const clear = useCallback((clearedTrackId) => {
    const player = playerRef.current
    if (player.dataset.trackId !== clearedTrackId) return
    player.pause()
    player.removeAttribute('src')
    delete player.dataset.trackId
    player.load()
    setTrackId('')
    setCurrentTime(0)
    setDuration(0)
  }, [])

  return { trackId, isPlaying, currentTime, duration, prime, playTrack, toggle, seek, clear }
}
