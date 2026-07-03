import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isCarbon = theme === 'carbon'

  return (
    <button
      onClick={toggleTheme}
      title={`Zu ${isCarbon ? 'Night Race' : 'Carbon'} wechseln`}
      className="flex items-center gap-1.5 text-f1-muted hover:text-white transition-colors text-xs uppercase tracking-widest shrink-0"
    >
      <span className={`inline-block w-2 h-2 rounded-full transition-colors ${
        isCarbon ? 'bg-[#FF1801]' : 'bg-transparent border border-f1-muted'
      }`} />
      {isCarbon ? 'Nacht' : 'Carbon'}
    </button>
  )
}
