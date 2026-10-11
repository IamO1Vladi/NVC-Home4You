import { useEffect, useState } from 'react';
import { paths, getLocaleFromPath } from '../routes/paths.js';

/**
 * Cookie consent card wired for Google Consent Mode v2 + GTM.
 * - Defaults are set to DENIED in index.html (before GTM loads).
 * - Accept/Reject will update consent and emit a dataLayer event.
 * - Re-opens on the `nvc:open-consent` window event (dispatched from the site footer's
 *   and the Privacy & Cookie Policy page's "Cookie settings" buttons).
 * NOTE: For EEA/UK personalized ads you should use a Google-certified CMP.
 *
 * Rendered as a small card in the site's own tokens (.consent-card in index.css) rather
 * than a black full-width strip. While it is mounted the <html> element carries
 * data-consent-open, which hides the floating contact dock so the two never share the
 * phone's bottom band.
 *
 * This component renders outside the React Router tree (see main.jsx), so it
 * reads the locale from window.location and links to the policy with a plain <a>.
 */
const COPY = {
  en: {
    label: 'Cookie consent',
    text: 'We use cookies for analytics and advertising. You can change your choice anytime.',
    reject: 'Reject',
    accept: 'Accept',
    learnMore: 'Privacy & Cookie Policy',
  },
  bg: {
    label: 'Съгласие за бисквитки',
    text: 'Използваме бисквитки за анализ и реклама. Можете да промените избора си по всяко време.',
    reject: 'Отказ',
    accept: 'Приемам',
    learnMore: 'Политика за поверителност и бисквитки',
  },
  el: {
    label: 'Συναίνεση για cookies',
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

  // Tell the page the card is up (CSS hides the contact dock on :root[data-consent-open]);
  // the cleanup removes it on close and on unmount alike.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    document.documentElement.dataset.consentOpen = '';
    return () => {
      delete document.documentElement.dataset.consentOpen;
    };
  }, [open]);

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

  // A named region, because this card renders OUTSIDE the router tree and therefore
  // outside every landmark on the page — it was the one element axe flagged on all 52
  // routes. role=region with a name makes it a landmark of its own.
  return (
    <div className="consent-card" data-nosnippet role="region" aria-label={t.label}>
      <span>
        {t.text}{' '}
        <a href={policyHref}>{t.learnMore}</a>
      </span>
      <div className="consent-card-actions">
        <button type="button" className="btn ghost" onClick={rejectAll}>{t.reject}</button>
        <button type="button" className="btn" onClick={acceptAll}>{t.accept}</button>
      </div>
    </div>
  );
}
