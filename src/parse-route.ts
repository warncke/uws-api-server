import type { HttpMethod } from './types.js';

export function parseRoute(
  route: string,
): { method: HttpMethod; path: string; paramNames: string[] } {
  const spaceIndex = route.indexOf(' ');
  if (spaceIndex === -1) {
    throw new Error(`Invalid route format: "${route}". Expected "METHOD /path"`);
  }

  const method = route.slice(0, spaceIndex).toUpperCase();
  const path = route.slice(spaceIndex + 1);

  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (!(validMethods as string[]).includes(method)) {
    throw new Error(`Invalid HTTP method "${method}" in route "${route}"`);
  }

  const paramNames: string[] = [];
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment.startsWith(':')) {
      paramNames.push(segment.slice(1));
    }
  }

  return { method: method as HttpMethod, path, paramNames };
}
