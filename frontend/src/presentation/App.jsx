import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, request } from '../application/api.js'
import { useAudioPlayer } from '../application/useAudioPlayer.js'
import { useTheme } from '../application/useTheme.js'
import AudioPlayer from './AudioPlayer.jsx'
import ThemeSwitcher from './ThemeSwitcher.jsx'

export default function App() {
  const [tracks, setTracks] = useState([])
  const [selectedTrack, setSelectedTrack] = useState('')
  const [minimum, setMinimum] = useState(15)
  const [maximum, setMaximum] = useState(80)
  const [state, setState] = useState({ status: 'IDLE' })
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const showError = useCallback(message => setError(message), [])
  const player = useAudioPlayer(showError)
  const { theme, setTheme } = useTheme()

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
    const events = new EventSource(`${API_BASE_URL}/timer/events`)
    events.addEventListener('play-track', (event) => {
      if (event.data) player.playTrack(event.data)
      loadState()
    })
    const refresh = setInterval(loadState, 5000)
    return () => {
      events.close()
      clearInterval(refresh)
    }
  }, [player.playTrack])

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
    if (selectedTrack) player.prime(selectedTrack)
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
      player.clear(selectedTrack)
      setTracks(remaining)
      setSelectedTrack(remaining[0]?.id || '')
      setConfirmingDelete(false)
      setRenaming(false)
    } catch (err) { setError(err.message) }
  }

  const running = state.status === 'RUNNING'
  const paused = state.status === 'PAUSED'
  const playingTrack = tracks.find(track => track.id === player.trackId)
  const selectedTrackDetails = tracks.find(track => track.id === selectedTrack)
  return <main>
    <section className="shell">
      <header className="header">
        <div className="brand"><span className="brand-mark">◷</span><span>Audio Countdown</span></div>
        <ThemeSwitcher theme={theme} onChange={setTheme} />
      </header>
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
      {player.trackId && <AudioPlayer
        trackName={playingTrack?.fileName}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        onToggle={player.toggle}
        onSeek={player.seek}
      />}
      {error && <div className="error">{error}</div>}
      <footer>Audio plays through your browser’s default system output.</footer>
    </section>
  </main>
}
