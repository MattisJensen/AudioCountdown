export default function ExternalMediaControls({
  availability,
  providerTabCount,
  resumableCount,
  busy,
  onPause,
  onResume,
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

  return <section className="card external-media" aria-label="Other browser audio">
    <div>
      <div className="card-label">OTHER BROWSER AUDIO</div>
      <p>{status}</p>
    </div>
    <div className="external-media-actions">
      <button className="secondary" onClick={onPause} disabled={!available || busy}>Stop other audio</button>
      <button className="secondary" onClick={onResume} disabled={!available || busy || resumableCount === 0}>Continue other audio</button>
    </div>
  </section>
}
