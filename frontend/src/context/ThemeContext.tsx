import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { t as translate, type Language, type TranslationKey } from '../i18n/translations'

interface ThemeContextType {
  darkMode: boolean
  language: Language
  toggleDarkMode: () => void
  setLanguage: (lang: string) => void
  t: (key: TranslationKey) => string
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('language') || 'en') as Language)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem('language', language)
  }, [language])

  const toggleDarkMode = useCallback(() => setDarkMode((prev) => !prev), [])
  const setLanguage = useCallback((lang: string) => setLanguageState(lang as Language), [])

  const t = useCallback((key: TranslationKey) => translate(key, language), [language])

  return (
    <ThemeContext.Provider value={{ darkMode, language, toggleDarkMode, setLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
