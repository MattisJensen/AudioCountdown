import { formatTime } from '../core/formatTime.js'

export default function AudioPlayer({ trackName, isPlaying, currentTime, duration, onToggle, onSeek }) {
  return <section className="card audio-player" aria-label="Audio player">
    <button className="player-toggle" onClick={onToggle} aria-label={isPlaying ? 'Pause audio' : 'Play audio'}>
      {isPlaying ? 'Ⅱ' : '▶'}
    </button>
    <div className="player-main">
      <div className="player-heading">
        <div><span>{isPlaying ? 'NOW PLAYING' : 'AUDIO PAUSED'}</span><strong>{trackName || 'Audio track'}</strong></div>
        <time>{formatTime(currentTime)} / {formatTime(duration)}</time>
      </div>
      <input
        className="player-progress"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(currentTime, duration || 0)}
        onInput={event => onSeek(event.currentTarget.value)}
        aria-label="Audio position"
        disabled={!duration}
      />
    </div>
    <div className="timer-independent">Timer continues independently</div>
  </section>
}
