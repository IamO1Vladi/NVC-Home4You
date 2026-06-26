import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pushes a `page_view` event to the dataLayer on every SPA navigation, and
 * re-fires a Meta Pixel `PageView` on client-side route changes (the pixel in
 * index.html only fires once on the initial hard load).
 *
 * Configure a GA4 Event tag in GTM that listens to event name: page_view
 * and maps parameters: page_location, page_path, page_title.
 */
export default function GtmPageviewListener() {
  const location = useLocation();
  const firstRun = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    const page_location = window.location.href;
    const page_path = location.pathname + location.search + location.hash;
    const page_title = document.title || '';

    window.dataLayer.push({
      event: 'page_view',
      page_location,
      page_path,
      page_title
    });

    // Meta Pixel: skip the first run (initial PageView already fired in index.html),
    // then track each subsequent SPA navigation. Only fires if consent loaded the pixel.
    if (firstRun.current) {
      firstRun.current = false;
    } else if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}
