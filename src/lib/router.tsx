import {useSyncExternalStore} from 'react';

export type Route =
  | {name: 'browse'}
  | {name: 'import'}
  | {name: 'progress'}
  | {name: 'dump'; id: string}
  | {name: 'practice'; sessionId: string}
  | {name: 'results'; sessionId: string};

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'dump' && parts[1]) return {name: 'dump', id: decodeURIComponent(parts[1])};
  if (parts[0] === 'practice' && parts[1]) {
    return {name: 'practice', sessionId: decodeURIComponent(parts[1])};
  }
  if (parts[0] === 'results' && parts[1]) {
    return {name: 'results', sessionId: decodeURIComponent(parts[1])};
  }
  if (parts[0] === 'import') return {name: 'import'};
  if (parts[0] === 'progress') return {name: 'progress'};
  return {name: 'browse'};
}

let cachedRoute = parseHash();

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    cachedRoute = parseHash();
    onChange();
    window.scrollTo({top: 0});
  };
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => cachedRoute, () => cachedRoute);
}

export function navigate(path: string): void {
  const next = path.startsWith('/') ? path : `/${path}`;
  if (window.location.hash === `#${next}`) return;
  window.location.hash = next;
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'dump':
      return `/dump/${encodeURIComponent(route.id)}`;
    case 'practice':
      return `/practice/${encodeURIComponent(route.sessionId)}`;
    case 'results':
      return `/results/${encodeURIComponent(route.sessionId)}`;
    default:
      return `/${route.name}`;
  }
}
