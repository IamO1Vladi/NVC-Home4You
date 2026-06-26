// src/routes/LocaleLayout.jsx
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function LocaleLayout({ locale }) {
  const { setLang } = useI18n()

  useEffect(() => {
    setLang(locale)
    document.documentElement.lang = locale
  }, [locale, setLang])

  return <Outlet />
}