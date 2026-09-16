const OPTIONS = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

export default function ThemeSwitcher({ theme, onChange }) {
  return <div className="theme-switcher" role="group" aria-label="Color theme">
    {OPTIONS.map(([value, label]) => <button
      key={value}
      className={theme === value ? 'active' : ''}
      type="button"
      aria-pressed={theme === value}
      onClick={() => onChange(value)}
    >{label}</button>)}
  </div>
}
