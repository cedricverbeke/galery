import { useEffect, useState } from 'react';

/** Lightweight hash-based router (no react-router dependency). */
export type Route =
  | { name: 'home' }
  | { name: 'access'; code?: string }
  | { name: 'gallery'; id: string }
  | { name: 'success'; sessionId?: string }
  | { name: 'admin' }
  | { name: 'admin-gallery'; id: string }
  | { name: 'admin-pricing' }
  | { name: 'admin-new-gallery' };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = clean.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart ?? '');

  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'access') return { name: 'access', code: parts[1] };
  if (parts[0] === 'gallery' && parts[1]) return { name: 'gallery', id: parts[1] };
  if (parts[0] === 'success') return { name: 'success', sessionId: params.get('session_id') ?? undefined };
  if (parts[0] === 'admin') {
    if (parts[1] === 'pricing') return { name: 'admin-pricing' };
    if (parts[1] === 'new-gallery') return { name: 'admin-new-gallery' };
    if (parts[1] === 'gallery' && parts[2]) return { name: 'admin-gallery', id: parts[2] };
    return { name: 'admin' };
  }
  return { name: 'home' };
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return route;
}
