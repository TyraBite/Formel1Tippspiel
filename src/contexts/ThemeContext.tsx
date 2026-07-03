import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'night-race' | 'carbon'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'night-race',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('f1-theme') as Theme) ?? 'night-race'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('f1-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'night-race' ? 'carbon' : 'night-race')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
