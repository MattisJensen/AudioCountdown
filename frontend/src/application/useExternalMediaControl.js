import { useCallback, useEffect, useRef, useState } from 'react'

const PAGE_MESSAGE_SOURCE = 'audio-countdown-page'
const EXTENSION_MESSAGE_SOURCE = 'audio-countdown-extension'
const PAUSE_TIMEOUT_MS = 750
const RESPONSE_TIMEOUT_MS = 4000

export function useExternalMediaControl() {
  const [availability, setAvailability] = useState('checking')
  const [providerTabCount, setProviderTabCount] = useState(0)
  const [resumableCount, setResumableCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const pendingRequests = useRef(new Map())
  const scheduledResume = useRef(null)
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

  const sendCommand = useCallback((command, timeoutMs = RESPONSE_TIMEOUT_MS) => new Promise(resolve => {
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
    }, window.location.origin)
  }), [])

  const updateState = useCallback(response => {
    if (!response?.ok) return false
    setAvailability('available')
    setProviderTabCount(response.providerTabCount)
    setResumableCount(response.resumableCount)
    return true
  }, [])

  const cancelScheduledResume = useCallback(() => {
    if (scheduledResume.current === null) return
    window.clearTimeout(scheduledResume.current)
    scheduledResume.current = null
  }, [])

  const pause = useCallback(async () => {
    cancelScheduledResume()
    setBusy(true)
    try {
      const response = await sendCommand('pause', PAUSE_TIMEOUT_MS)
      updateState(response)
      return response
    } finally {
      setBusy(false)
    }
  }, [cancelScheduledResume, sendCommand, updateState])

  const resume = useCallback(async () => {
    cancelScheduledResume()
    setBusy(true)
    try {
      const response = await sendCommand('resume')
      updateState(response)
      return response
    } finally {
      setBusy(false)
    }
  }, [cancelScheduledResume, sendCommand, updateState])

  const resumeAfter = useCallback(delayMs => {
    cancelScheduledResume()
    scheduledResume.current = window.setTimeout(() => {
      scheduledResume.current = null
      void resume()
    }, delayMs)
  }, [cancelScheduledResume, resume])

  useEffect(() => {
    let active = true
    sendCommand('status', PAUSE_TIMEOUT_MS).then(response => {
      if (active) updateState(response)
    })
    return () => {
      active = false
      cancelScheduledResume()
    }
  }, [cancelScheduledResume, sendCommand, updateState])

  return {
    availability,
    providerTabCount,
    resumableCount,
    busy,
    pause,
    resume,
    resumeAfter,
  }
}
