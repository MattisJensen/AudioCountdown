import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Something went wrong.')
  return body
}

function App() {
  const [tracks, setTracks] = useState([])
  const [selectedTrack, setSelectedTrack] = useState('')
  const [minimum, setMinimum] = useState(15)
  const [maximum, setMaximum] = useState(80)
  const [state, setState] = useState({ status: 'IDLE' })
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const audio = useRef(new Audio())

  const load = async () => {
    try {
      const [nextTracks, nextState] = await Promise.all([request('/tracks'), request('/state')])
      setTracks(nextTracks)
      setState(nextState)
      setSelectedTrack(nextState.selectedTrackId || nextTracks[0]?.id || '')
    } catch (err) { setError(err.message) }
  }

  useEffect(() => {
    load()
    const events = new EventSource(`${API}/timer/events`)
    events.addEventListener('play-track', (event) => {
      if (event.data) {
        audio.current.src = `${API}/tracks/${event.data}/content`
        audio.current.play().catch(() => setError('The browser blocked audio playback. Press Start once to allow audio.'))
      }
      load()
    })
    const refresh = setInterval(load, 5000)
    return () => { events.close(); clearInterval(refresh) }
  }, [])

  const action = async (path) => {
    setError('')
    try { setState(await request(path, { method: 'POST' })) } catch (err) { setError(err.message) }
  }

  const start = async () => {
    setError('')
    try {
      setState(await request('/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minimumMinutes: Number(minimum), maximumMinutes: Number(maximum), trackId: selectedTrack }) }))
      audio.current.src = `${API}/tracks/${selectedTrack}/content`
      audio.current.muted = true
      audio.current.play().then(() => { audio.current.pause(); audio.current.currentTime = 0; audio.current.muted = false }).catch(() => { audio.current.muted = false })
    } catch (err) { setError(err.message) }
  }

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const form = new FormData(); form.append('file', file)
      const track = await request('/tracks', { method: 'POST', body: form })
      setTracks(current => [...current, track]); setSelectedTrack(track.id)
    } catch (err) { setError(err.message) } finally { setUploading(false); event.target.value = '' }
  }

  const running = state.status === 'RUNNING'
  const paused = state.status === 'PAUSED'
  return <main>
    <section className="shell">
      <div className="brand"><span className="brand-mark">◷</span><span>Audio Countdown</span></div>
      <div className="hero"><p className="eyebrow">FOCUS RHYTHM</p><h1>Let time do the talking.</h1><p className="subhead">Set a quiet, random interval. Your selected sound will play when the countdown reaches zero.</p></div>
      <div className="grid">
        <section className="card timer-card">
          <div className="card-label">CURRENT COUNTDOWN</div>
          <div className="countdown">{state.status === 'IDLE' ? <span className="idle">Ready when you are</span> : <><strong>{state.displayedMinutesLeft}</strong><span>minutes left</span></>}</div>
          <p className="starting">{state.startingMinutes ? `Counting down from ${state.startingMinutes} minutes` : 'Choose a range, then press start'}</p>
          <div className="controls">
            {state.status === 'IDLE' && <button className="primary" onClick={start} disabled={!selectedTrack}>Start</button>}
            {running && <button className="primary" onClick={() => action('/timer/pause')}>Pause</button>}
            {paused && <button className="primary" onClick={() => action('/timer/resume')}>Continue</button>}
            {(running || paused) && <button className="secondary" onClick={() => action('/timer/reset')}>Reset</button>}
          </div>
        </section>
        <section className="card setup-card">
          <div className="card-label">INTERVAL RANGE</div>
          <div className="range-row"><label>From<input type="number" min="1" max="1440" value={minimum} onChange={e => setMinimum(e.target.value)} disabled={running || paused}/><small>minutes</small></label><span className="to">to</span><label>Until<input type="number" min="1" max="1440" value={maximum} onChange={e => setMaximum(e.target.value)} disabled={running || paused}/><small>minutes</small></label></div>
          <div className="card-label track-label">SOUNDTRACK</div>
          <label className="select-wrap"><select value={selectedTrack} onChange={e => setSelectedTrack(e.target.value)} disabled={running || paused}><option value="">Select an audio track</option>{tracks.map(track => <option key={track.id} value={track.id}>{track.fileName}</option>)}</select></label>
          <label className="upload"><span>{uploading ? 'Uploading…' : '+ Add another track'}</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/aac,audio/flac,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={upload} disabled={uploading}/></label>
        </section>
      </div>
      {error && <div className="error">{error}</div>}
      <footer>Audio plays through your browser’s default system output.</footer>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
