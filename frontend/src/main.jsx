import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || '/api'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(response.status === 413 ? 'The audio file is too large. The maximum size is 20 MB.' : body.message || `Request failed with status ${response.status}.`)
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
  const [playingTrackId, setPlayingTrackId] = useState('')
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioTime, setAudioTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const audio = useRef(new Audio())

  const loadTracks = async () => {
    try {
      const nextTracks = await request('/tracks')
      setTracks(nextTracks)
      setSelectedTrack(current => current || nextTracks[0]?.id || '')
    } catch (err) { setError(err.message) }
  }

  const loadState = async () => {
    try {
      const nextState = await request('/state')
      setState(nextState)
      setSelectedTrack(current => nextState.selectedTrackId || current)
    } catch (err) { setError(err.message) }
  }

  useEffect(() => {
    loadTracks()
    loadState()
    const player = audio.current
    const updateTime = () => setAudioTime(player.currentTime)
    const updateDuration = () => setAudioDuration(Number.isFinite(player.duration) ? player.duration : 0)
    const markPlaying = () => setAudioPlaying(true)
    const markPaused = () => setAudioPlaying(false)
    player.addEventListener('timeupdate', updateTime)
    player.addEventListener('loadedmetadata', updateDuration)
    player.addEventListener('durationchange', updateDuration)
    player.addEventListener('play', markPlaying)
    player.addEventListener('pause', markPaused)
    player.addEventListener('ended', markPaused)
    const events = new EventSource(`${API}/timer/events`)
    events.addEventListener('play-track', (event) => {
      if (event.data) {
        player.pause()
        player.currentTime = 0
        setPlayingTrackId(event.data)
        setAudioTime(0)
        setAudioDuration(0)
        player.src = `${API}/tracks/${event.data}/content`
        player.play().catch(() => setError('The browser blocked audio playback. Use the player to start the audio.'))
      }
      loadState()
    })
    const refresh = setInterval(loadState, 5000)
    return () => {
      events.close()
      clearInterval(refresh)
      player.removeEventListener('timeupdate', updateTime)
      player.removeEventListener('loadedmetadata', updateDuration)
      player.removeEventListener('durationchange', updateDuration)
      player.removeEventListener('play', markPlaying)
      player.removeEventListener('pause', markPaused)
      player.removeEventListener('ended', markPaused)
    }
  }, [])

  const action = async (path) => {
    setError('')
    try { setState(await request(path, { method: 'POST' })) } catch (err) { setError(err.message) }
  }

  const changeSelectedTrack = async (nextTrackId) => {
    const previousTrackId = selectedTrack
    setSelectedTrack(nextTrackId)
    setRenaming(false)
    setConfirmingDelete(false)
    if (state.status === 'IDLE' || !nextTrackId) return
    setError('')
    try {
      setState(await request('/timer/track', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId: nextTrackId }) }))
    } catch (err) {
      setSelectedTrack(previousTrackId)
      setError(err.message)
    }
  }

  const start = async () => {
    setError('')
    try {
      setState(await request('/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minimumMinutes: Number(minimum), maximumMinutes: Number(maximum), trackId: selectedTrack }) }))
    } catch (err) { setError(err.message) }
  }

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('The audio file is too large. The maximum size is 20 MB.')
      event.target.value = ''
      return
    }
    setUploading(true); setError('')
    try {
      const form = new FormData(); form.append('file', file)
      const track = await request('/tracks', { method: 'POST', body: form })
      setTracks(current => [...current, track])
      await changeSelectedTrack(track.id)
    } catch (err) { setError(err.message) } finally { setUploading(false); event.target.value = '' }
  }

  const toggleAudio = () => {
    if (audioPlaying) {
      audio.current.pause()
      return
    }
    if (audioDuration && audio.current.currentTime >= audioDuration) audio.current.currentTime = 0
    audio.current.play().catch(() => setError('The browser blocked audio playback. Please try again.'))
  }

  const seekAudio = (event) => {
    const nextTime = Number(event.target.value)
    audio.current.currentTime = nextTime
    setAudioTime(nextTime)
  }

  const beginRename = () => {
    const track = tracks.find(item => item.id === selectedTrack)
    if (!track) return
    setRenameValue(track.fileName)
    setRenaming(true)
    setConfirmingDelete(false)
  }

  const renameTrack = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const renamed = await request(`/tracks/${selectedTrack}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: renameValue }) })
      setTracks(current => current.map(track => track.id === renamed.id ? renamed : track))
      setRenaming(false)
    } catch (err) { setError(err.message) }
  }

  const deleteTrack = async () => {
    setError('')
    try {
      await request(`/tracks/${selectedTrack}`, { method: 'DELETE' })
      const remaining = tracks.filter(track => track.id !== selectedTrack)
      if (playingTrackId === selectedTrack) {
        audio.current.pause()
        audio.current.removeAttribute('src')
        setPlayingTrackId('')
        setAudioTime(0)
        setAudioDuration(0)
      }
      setTracks(remaining)
      setSelectedTrack(remaining[0]?.id || '')
      setConfirmingDelete(false)
      setRenaming(false)
    } catch (err) { setError(err.message) }
  }

  const running = state.status === 'RUNNING'
  const paused = state.status === 'PAUSED'
  const playingTrack = tracks.find(track => track.id === playingTrackId)
  const selectedTrackDetails = tracks.find(track => track.id === selectedTrack)
  return <main>
    <section className="shell">
      <div className="brand"><span className="brand-mark">◷</span><span>Audio Countdown</span></div>
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
          <label className="select-wrap"><select value={selectedTrack} onChange={event => changeSelectedTrack(event.target.value)}><option value="" disabled={running || paused}>Select an audio track</option>{tracks.map(track => <option key={track.id} value={track.id}>{track.fileName}</option>)}</select></label>
          {selectedTrackDetails && <div className="selected-track-note"><span></span>Plays at the next zero: {selectedTrackDetails.fileName}</div>}
          {!renaming && <div className="track-actions"><button className="track-action" onClick={beginRename} disabled={!selectedTrack}>Rename</button><button className="track-action danger" onClick={() => setConfirmingDelete(true)} disabled={!selectedTrack || running || paused}>Delete</button></div>}
          {renaming && <form className="track-edit" onSubmit={renameTrack}><input value={renameValue} onChange={event => setRenameValue(event.target.value)} maxLength="200" aria-label="Audio track name" autoFocus/><div><button className="small-primary" type="submit" disabled={!renameValue.trim()}>Save</button><button className="small-secondary" type="button" onClick={() => setRenaming(false)}>Cancel</button></div></form>}
          {confirmingDelete && <div className="delete-confirm"><span>Delete “{selectedTrackDetails?.fileName}”?</span><div><button className="small-danger" onClick={deleteTrack}>Delete</button><button className="small-secondary" onClick={() => setConfirmingDelete(false)}>Cancel</button></div></div>}
          <label className="upload"><span>{uploading ? 'Uploading…' : '+ Add another track'}</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/aac,audio/flac,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={upload} disabled={uploading}/></label>
        </section>
      </div>
      {playingTrackId && <section className="card audio-player">
        <button className="player-toggle" onClick={toggleAudio} aria-label={audioPlaying ? 'Pause audio' : 'Continue audio'}>{audioPlaying ? 'Ⅱ' : '▶'}</button>
        <div className="player-main">
          <div className="player-heading"><div><span>{audioPlaying ? 'NOW PLAYING' : 'AUDIO PAUSED'}</span><strong>{playingTrack?.fileName || 'Audio track'}</strong></div><time>{formatTime(audioTime)} / {formatTime(audioDuration)}</time></div>
          <input className="player-progress" type="range" min="0" max={audioDuration || 0} step="0.1" value={Math.min(audioTime, audioDuration || 0)} onChange={seekAudio} aria-label="Audio position" disabled={!audioDuration}/>
        </div>
        <div className="timer-independent">Timer continues independently</div>
      </section>}
      {error && <div className="error">{error}</div>}
      <footer>Audio plays through your browser’s default system output.</footer>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
