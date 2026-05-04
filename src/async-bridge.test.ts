import uWS, { us_listen_socket } from 'uWebSockets.js';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { AsyncBridge } from './async-bridge.js';
import { SchemaValidator } from './schema-validator.js';
import type { ValidatedRequestParams } from './types.js';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function fetchUrl(
  url: string,
  options?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const opts: { method?: string; body?: string; headers?: Record<string, string> } = {
    method: options?.method ?? 'GET',
  };
  if (options?.body) {
    opts.body = options.body;
  }
  if (options?.headers) {
    opts.headers = options.headers;
  }

  return fetch(url, opts).then(async (res) => {
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      status: res.status,
      body: await res.text(),
      headers,
    };
  });
}

describe('AsyncBridge', () => {
  let apps: Array<{ app: uWS.TemplatedApp; listenSocket: us_listen_socket }> = [];

  afterEach(() => {
    for (const { listenSocket } of apps) {
      try {
        uWS.us_listen_socket_close(listenSocket);
      } catch {
        // already closed
      }
    }
    apps = [];
  });

  it('successful async handler returns 201 with JSON body', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'POST /test',
      handler: async (params: ValidatedRequestParams) => ({
        statusCode: 201,
        body: { id: 1, received: params.body },
      }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.post('/test', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(`http://0.0.0.0:${port}/test`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(201);
    const parsed = JSON.parse(response.body);
    expect(parsed.id).toBe(1);
    expect(parsed.received).toEqual({ name: 'Alice' });
    expect(response.headers['content-type']).toBe('application/json');
  });

  it('handler throws an error returns 500', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /error',
      handler: async () => {
        throw new Error('db down');
      },
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.get('/error', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(`http://0.0.0.0:${port}/error`);
    expect(response.status).toBe(500);
    const parsed = JSON.parse(response.body);
    expect(parsed.error).toBe('db down');
  });

  it('validation error returns 400', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const schema = {
      type: 'object',
      properties: {
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
          required: ['name'],
        },
      },
    };
    const handlerModule = {
      route: 'POST /validate',
      schema,
      handler: async (_params: ValidatedRequestParams) => ({
        statusCode: 200,
        body: { ok: true },
      }),
    };

    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.post('/validate', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(`http://0.0.0.0:${port}/validate`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(400);
    const parsed = JSON.parse(response.body);
    expect(parsed.error).toBe('Validation failed');
    expect(parsed.details).toBeDefined();
  });

  it('returns 204 when body is undefined', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /nocontent',
      handler: async () => ({ statusCode: 204 }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.get('/nocontent', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(`http://0.0.0.0:${port}/nocontent`);
    expect(response.status).toBe(204);
    expect(response.body).toBe('');
  });

  it('handles route parameters', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /users/:id',
      handler: async (params: ValidatedRequestParams) => ({
        statusCode: 200,
        body: { userId: params.params.id },
      }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, ['id']);

    const app = uWS.App();
    app.get('/users/:id', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(
      `http://0.0.0.0:${port}/users/42`,
    );
    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.userId).toBe('42');
  });

  it('handles non-JSON body as string', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'POST /raw',
      handler: async (params: ValidatedRequestParams) => ({
        statusCode: 200,
        body: { received: params.body },
      }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.post('/raw', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(`http://0.0.0.0:${port}/raw`, {
      method: 'POST',
      body: 'plain text body',
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.received).toBe('plain text body');
  });

  it('handles query param without value', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /search',
      handler: async (params: ValidatedRequestParams) => ({
        statusCode: 200,
        body: { query: params.query },
      }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.get('/search', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(
      `http://0.0.0.0:${port}/search?flag`,
    );
    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.query).toEqual({ flag: '' });
  });

  it('returns 204 with custom headers', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /custom',
      handler: async () => ({
        statusCode: 204,
        headers: { 'x-custom': 'value' },
      }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.get('/custom', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(`http://0.0.0.0:${port}/custom`);
    expect(response.status).toBe(204);
    expect(response.body).toBe('');
  });

  it('handler without schema passes through all data', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /passthrough',
      handler: async (params: ValidatedRequestParams) => ({
        statusCode: 200,
        body: { query: params.query, headers: params.headers },
      }),
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.get('/passthrough', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const response = await fetchUrl(
      `http://0.0.0.0:${port}/passthrough?foo=bar`,
    );
    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.query.foo).toBe('bar');
  });

  it('aborted request does not crash', async () => {
    const port = await getFreePort();
    const validator = new SchemaValidator();
    const handlerModule = {
      route: 'GET /slow',
      handler: async () => {
        await new Promise((r) => setTimeout(r, 500));
        return { statusCode: 200 };
      },
    };
    const bridge = new AsyncBridge(validator, handlerModule, []);

    const app = uWS.App();
    app.get('/slow', (res, req) => bridge.handle(res, req));

    const listenSocket = await new Promise<us_listen_socket>((resolve, reject) => {
      app.listen('0.0.0.0', port, (token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to listen'));
      });
    });
    apps.push({ app, listenSocket });

    const controller = new AbortController();
    const fetchPromise = fetch(`http://0.0.0.0:${port}/slow`, {
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 20);

    await expect(fetchPromise).rejects.toThrow();

    await new Promise((r) => setTimeout(r, 100));
  });
});
