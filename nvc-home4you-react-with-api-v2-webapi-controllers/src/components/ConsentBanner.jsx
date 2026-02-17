import { useEffect, useState } from 'react';

/**
 * Minimal cookie banner wired for Google Consent Mode v2 + GTM.
 * - Defaults are set to DENIED in index.html (before GTM loads).
 * - Accept/Reject will update consent and emit a dataLayer event.
 * NOTE: For EEA/UK personalized ads you should use a Google-certified CMP.
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('consent.choice');
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function(){ window.dataLayer.push(arguments); };
    }
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
    <div style={barStyle}>
      <span style={{maxWidth:'60ch'}}>
        We use cookies for analytics and advertising. You can change your choice by clearing site data.
      </span>
      <div style={{display:'flex', gap:'0.5rem'}}>
        <button onClick={rejectAll} style={btnStyle('outline')}>Reject</button>
        <button onClick={acceptAll} style={btnStyle('solid')}>Accept</button>
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
