export default function ExternalMediaControls({
  availability,
  providerTabCount,
  resumableCount,
  otherVolume,
  appVolume,
  busy,
  onPause,
  onResume,
  onOtherVolumeChange,
  onAppVolumeChange,
}) {
  const available = availability === 'available'
  let status = 'Checking for the Firefox companion extension…'
  if (availability === 'unavailable') {
    status = 'Install the Firefox companion extension to control supported music tabs.'
  } else if (available && resumableCount > 0) {
    status = `${resumableCount} audio source${resumableCount === 1 ? '' : 's'} stopped by Audio Countdown.`
  } else if (available && providerTabCount > 0) {
    status = 'Ready. No supported audio is currently stopped.'
  } else if (available) {
    status = 'Ready. Open Apple Music, Spotify, YouTube, or SoundCloud in Firefox.'
  }

  return <section className="card external-media" aria-label="Audio controls">
    <div className="external-media-heading">
      <div>
        <div className="card-label">AUDIO CONTROLS</div>
        <p>{status}</p>
      </div>
      <div className="external-media-actions">
        <button className="secondary" onClick={onPause} disabled={!available || busy}>Stop other audio</button>
        <button className="secondary" onClick={onResume} disabled={!available || busy || resumableCount === 0}>Continue other audio</button>
      </div>
    </div>
    <div className="volume-controls">
      <VolumeSlider
        label="Other browser audio"
        value={otherVolume}
        onChange={onOtherVolumeChange}
        disabled={!available || providerTabCount === 0}
      />
      <VolumeSlider label="Audio Countdown" value={appVolume} onChange={onAppVolumeChange} />
    </div>
  </section>
}

function VolumeSlider({ label, value, onChange, disabled = false }) {
  const percentage = Math.round(value * 100)
  return <label className="volume-control">
    <span><strong>{label}</strong><output>{percentage}%</output></span>
    <input
      className="volume-slider"
      type="range"
      min="0"
      max="100"
      step="1"
      value={percentage}
      onChange={event => onChange(Number(event.target.value) / 100)}
      aria-label={`${label} volume`}
      disabled={disabled}
    />
  </label>
}
