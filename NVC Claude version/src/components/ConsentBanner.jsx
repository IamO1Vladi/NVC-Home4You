import { useEffect, useState } from 'react';
import { paths, getLocaleFromPath } from '../routes/paths.js';

/**
 * Minimal cookie banner wired for Google Consent Mode v2 + GTM.
 * - Defaults are set to DENIED in index.html (before GTM loads).
 * - Accept/Reject will update consent and emit a dataLayer event.
 * - Re-opens on the `nvc:open-consent` window event (dispatched from the
 *   Privacy & Cookie Policy page's "Cookie settings" button).
 * NOTE: For EEA/UK personalized ads you should use a Google-certified CMP.
 *
 * This component renders outside the React Router tree (see main.jsx), so it
 * reads the locale from window.location and links to the policy with a plain <a>.
 */
const COPY = {
  en: {
    text: 'We use cookies for analytics and advertising. You can change your choice anytime.',
    reject: 'Reject',
    accept: 'Accept',
    learnMore: 'Privacy & Cookie Policy',
  },
  bg: {
    text: 'Използваме бисквитки за анализ и реклама. Можете да промените избора си по всяко време.',
    reject: 'Отказ',
    accept: 'Приемам',
    learnMore: 'Политика за поверителност и бисквитки',
  },
  el: {
    text: 'Χρησιμοποιούμε cookies για ανάλυση και διαφήμιση. Μπορείτε να αλλάξετε την επιλογή σας οποτεδήποτε.',
    reject: 'Απόρριψη',
    accept: 'Αποδοχή',
    learnMore: 'Πολιτική Απορρήτου & Cookies',
  },
};

// Staff-only areas: internal tools and the admin panel. Not public pages, so there is no
// visitor to ask for advertising consent — showing the banner there is just noise in a
// tool people use all day.
function isStaffArea(pathname = '') {
  return pathname.startsWith('/internal/') || pathname === '/admin' || pathname.startsWith('/admin/');
}

export default function ConsentBanner() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (isStaffArea(window.location.pathname)) return false;
    return !localStorage.getItem('consent.choice');
  });

  const locale =
    (typeof window !== 'undefined' && getLocaleFromPath(window.location.pathname)) || 'en';
  const t = COPY[locale] || COPY.en;
  const policyHref = paths.privacy[locale] || paths.privacy.en;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function(){ window.dataLayer.push(arguments); };
    }
  }, []);

  // Allow the policy page (and anything else) to re-open the banner so users can
  // review or change their cookie choice after dismissing it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = () => setOpen(true);
    window.addEventListener('nvc:open-consent', onOpen);
    return () => window.removeEventListener('nvc:open-consent', onOpen);
  }, []);

  if (!open) return null;

  const acceptAll = () => {
    localStorage.setItem('consent.choice', 'accepted');
    window.gtag('consent','update', {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    window.dataLayer.push({ event: 'consent_accept' });
    // Load the Meta Pixel now that the visitor has consented (see index.html).
    if (typeof window.loadMetaPixel === 'function') {
      window.loadMetaPixel();
    }
    window.dispatchEvent(new Event('consent-accepted'));
    setOpen(false);
  };

  const rejectAll = () => {
    localStorage.setItem('consent.choice', 'rejected');
    window.gtag('consent','update', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.dataLayer.push({ event: 'consent_reject' });
    setOpen(false);
  };

  return (
    <div data-nosnippet style={barStyle}>
      <span style={{maxWidth:'60ch'}}>
        {t.text}{' '}
        <a href={policyHref} style={{color:'#fff', textDecoration:'underline'}}>{t.learnMore}</a>
      </span>
      <div style={{display:'flex', gap:'0.5rem'}}>
        <button onClick={rejectAll} style={btnStyle('outline')}>{t.reject}</button>
        <button onClick={acceptAll} style={btnStyle('solid')}>{t.accept}</button>
      </div>
    </div>
  );
}

const barStyle = {
  position: 'fixed',
  left: 0, right: 0, bottom: 0,
  padding: '1rem',
  background: '#111', color: '#fff',
  zIndex: 10000,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: '0.75rem', flexWrap: 'wrap',
  boxShadow: '0 -4px 12px rgba(0,0,0,0.2)'
};

function btnStyle(variant) {
  if (variant === 'solid') {
    return {
      padding: '0.6rem 1rem',
      border: 'none',
      cursor: 'pointer'
    };
  }
  return {
    padding: '0.6rem 1rem',
    border: '1px solid #fff',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer'
  };
}
