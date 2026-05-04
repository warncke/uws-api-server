import { parseRoute } from './parse-route.js';

describe('parseRoute', () => {
  it('parses a valid route without parameters', () => {
    const result = parseRoute('GET /health');
    expect(result).toEqual({
      method: 'GET',
      path: '/health',
      paramNames: [],
    });
  });

  it('parses a valid route with parameters', () => {
    const result = parseRoute('PATCH /users/:userId');
    expect(result).toEqual({
      method: 'PATCH',
      path: '/users/:userId',
      paramNames: ['userId'],
    });
  });

  it('parses a POST route with multiple parameters', () => {
    const result = parseRoute('POST /orgs/:orgId/users/:userId');
    expect(result).toEqual({
      method: 'POST',
      path: '/orgs/:orgId/users/:userId',
      paramNames: ['orgId', 'userId'],
    });
  });

  it('handles DELETE method', () => {
    const result = parseRoute('DELETE /items/:id');
    expect(result.method).toBe('DELETE');
    expect(result.paramNames).toEqual(['id']);
  });

  it('handles PUT method', () => {
    const result = parseRoute('PUT /items/:id');
    expect(result.method).toBe('PUT');
  });

  it('rejects an invalid method', () => {
    expect(() => parseRoute('CHEESE /users')).toThrow(
      'Invalid HTTP method',
    );
  });

  it('rejects a route with no space', () => {
    expect(() => parseRoute('GETPATH')).toThrow('Invalid route format');
  });

  it('is case-insensitive for method', () => {
    const result = parseRoute('get /health');
    expect(result.method).toBe('GET');
  });
});
