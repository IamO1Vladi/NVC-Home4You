import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pushes a `page_view` event to the dataLayer on every SPA navigation.
 * Configure a GA4 Event tag in GTM that listens to event name: page_view
 * and maps parameters: page_location, page_path, page_title.
 */
export default function GtmPageviewListener() {
  const location = useLocation();

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
  }, [location.pathname, location.search, location.hash]);

  return null;
}
