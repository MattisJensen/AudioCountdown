import { useEffect, useState } from 'react'

export function useCountdown(timerState) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    setNow(Date.now())
    if (timerState.status !== 'RUNNING' || !timerState.completesAt) return undefined

    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [timerState.status, timerState.completesAt])

  if (timerState.status === 'RUNNING' && timerState.completesAt) {
    const completionTime = Date.parse(timerState.completesAt)
    return Number.isFinite(completionTime)
      ? Math.max(0, Math.ceil((completionTime - now) / 1000))
      : 0
  }

  if (timerState.status === 'PAUSED') {
    return Math.max(0, timerState.pausedSecondsLeft ?? 0)
  }

  return null
}
