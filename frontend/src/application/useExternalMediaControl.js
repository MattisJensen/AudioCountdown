import { useCallback, useEffect, useRef, useState } from 'react'

const PAGE_MESSAGE_SOURCE = 'audio-countdown-page'
const EXTENSION_MESSAGE_SOURCE = 'audio-countdown-extension'
const PAUSE_TIMEOUT_MS = 750
const RESPONSE_TIMEOUT_MS = 4000

export function useExternalMediaControl() {
  const [availability, setAvailability] = useState('checking')
  const [providerTabCount, setProviderTabCount] = useState(0)
  const [resumableCount, setResumableCount] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [busy, setBusy] = useState(false)
  const pendingRequests = useRef(new Map())
  const pendingVolumeUpdate = useRef(null)
  const nextRequestId = useRef(1)

  useEffect(() => {
    const requests = pendingRequests.current
    const receiveResponse = event => {
      if (event.source !== window
          || event.origin !== window.location.origin
          || event.data?.source !== EXTENSION_MESSAGE_SOURCE) {
        return
      }

      const pending = requests.get(event.data.requestId)
      if (!pending) return
      window.clearTimeout(pending.timeout)
      requests.delete(event.data.requestId)
      pending.resolve(event.data.response)
    }

    window.addEventListener('message', receiveResponse)
    return () => {
      window.removeEventListener('message', receiveResponse)
      for (const pending of requests.values()) {
        window.clearTimeout(pending.timeout)
        pending.resolve(null)
      }
      requests.clear()
    }
  }, [])

  const sendCommand = useCallback((command, details = {}, timeoutMs = RESPONSE_TIMEOUT_MS) => new Promise(resolve => {
    const requestId = `${Date.now()}-${nextRequestId.current++}`
    const timeout = window.setTimeout(() => {
      pendingRequests.current.delete(requestId)
      setAvailability('unavailable')
      resolve(null)
    }, timeoutMs)

    pendingRequests.current.set(requestId, { resolve, timeout })
    window.postMessage({
      source: PAGE_MESSAGE_SOURCE,
      requestId,
      command,
      ...details,
    }, window.location.origin)
  }), [])

  const updateState = useCallback(response => {
    if (!response?.ok) return false
    setAvailability('available')
    setProviderTabCount(response.providerTabCount)
    setResumableCount(response.resumableCount)
    if (Number.isFinite(response.volume)) setVolumeState(response.volume)
    return true
  }, [])

  const pause = useCallback(async () => {
    setBusy(true)
    try {
      const response = await sendCommand('pause', {}, PAUSE_TIMEOUT_MS)
      updateState(response)
      return response
    } finally {
      setBusy(false)
    }
  }, [sendCommand, updateState])

  const resume = useCallback(async () => {
    setBusy(true)
    try {
      const response = await sendCommand('resume')
      updateState(response)
      return response
    } finally {
      setBusy(false)
    }
  }, [sendCommand, updateState])

  const setVolume = useCallback((nextVolume) => {
    const boundedVolume = Math.min(1, Math.max(0, Number(nextVolume)))
    setVolumeState(boundedVolume)
    if (pendingVolumeUpdate.current !== null) window.clearTimeout(pendingVolumeUpdate.current)
    pendingVolumeUpdate.current = window.setTimeout(async () => {
      pendingVolumeUpdate.current = null
      const response = await sendCommand('set-volume', { volume: boundedVolume })
      updateState(response)
    }, 60)
  }, [sendCommand, updateState])

  useEffect(() => {
    let active = true
    sendCommand('status', {}, PAUSE_TIMEOUT_MS).then(response => {
      if (active) updateState(response)
    })
    return () => {
      active = false
      if (pendingVolumeUpdate.current !== null) window.clearTimeout(pendingVolumeUpdate.current)
    }
  }, [sendCommand, updateState])

  return {
    availability,
    providerTabCount,
    resumableCount,
    volume,
    busy,
    pause,
    resume,
    setVolume,
  }
}
