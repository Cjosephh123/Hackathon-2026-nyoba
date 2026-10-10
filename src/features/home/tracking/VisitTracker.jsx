import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackVisit } from '../services/analyticsService.js';

/**
 * Invisible component: logs a page view each time the route changes.
 * Mount it ONCE near the top of your app (inside <BrowserRouter>).
 * This is what feeds the "Digital access" number.
 */
export default function VisitTracker() {
  const { pathname } = useLocation();
  const lastPath = useRef(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackVisit(pathname);
  }, [pathname]);

  return null;
}
