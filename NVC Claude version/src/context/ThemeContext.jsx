import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
const ThemeContext = createContext(null)
const STORAGE_KEY = 'theme'
function getSystem(){ return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' }
export function ThemeProvider({ children }){
  const [theme, setTheme] = useState(()=> localStorage.getItem(STORAGE_KEY) || 'system')
  const [system, setSystem] = useState(getSystem())
  useEffect(()=>{
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', onChange); return ()=>mq.removeEventListener?.('change', onChange)
  }, [])
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, theme) }, [theme])
  const resolved = theme === 'system' ? system : theme
  useEffect(()=>{ const el=document.documentElement; el.setAttribute('data-theme', resolved); el.style.colorScheme=resolved }, [resolved])
  const value = useMemo(()=>({ theme, setTheme, resolvedTheme: resolved }), [theme, resolved])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
export function useTheme(){ const ctx = useContext(ThemeContext); if(!ctx) throw new Error('useTheme within provider'); return ctx }
