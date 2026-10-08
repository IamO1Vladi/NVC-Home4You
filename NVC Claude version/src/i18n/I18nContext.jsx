import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { dictionaries } from './translations'
const I18nContext = createContext(null)
// Exported for the one reader outside the provider: ConsentBanner renders outside the
// router and the provider, and needs the remembered language for paths without a locale.
export const LANG_STORAGE_KEY = 'lang'
const STORAGE_KEY = LANG_STORAGE_KEY
export function I18nProvider({ children }){
  const [lang, setLang] = useState(()=> localStorage.getItem(STORAGE_KEY) || detect())
  function detect(){ const n=(navigator.language||'bg').toLowerCase(); if(n.startsWith('bg')) return 'bg'; if(n.startsWith('el')) return 'el'; return 'en' }
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, lang) }, [lang])
  const dict = dictionaries[lang] || dictionaries.en
  const t = (path, params)=>{
    const parts = path.split('.'); let cur = dict
    for(const p of parts){ cur = (cur && typeof cur==='object') ? cur[p] : undefined }
    if(typeof cur === 'string'){ return params ? Object.keys(params).reduce((acc,k)=>acc.replaceAll(`{${k}}`, params[k]), cur) : cur }
    return cur
  }
  const value = useMemo(()=>({ lang, setLang, t, dict }), [lang, dict])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
export function useI18n(){ const ctx = useContext(I18nContext); if(!ctx) throw new Error('useI18n within provider'); return ctx }
