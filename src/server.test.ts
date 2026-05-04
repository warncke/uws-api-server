import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { Server } from './server.js';
import { Router } from './router.js';

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

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'server-test-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  return dir;
}

function writeHandlerFile(
  dir: string,
  filename: string,
  content: string,
): void {
  writeFileSync(join(dir, filename), content, 'utf-8');
}

let servers: Server[] = [];

afterEach(() => {
  for (const server of servers) {
    server.close();
  }
  servers = [];
});

async function startServer(dir: string, port: number): Promise<Server> {
  const handlers = await Router.loadHandlers(dir);
  const server = new Server({ port, host: '0.0.0.0', handlersDir: dir }, handlers);
  await server.listen();
  servers.push(server);
  return server;
}

describe('Server integration', () => {
  it('GET /health returns { status: "ok" }', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'health.js',
      `
export default {
  route: "GET /health",
  handler: async () => ({ statusCode: 200, body: { status: "ok" } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('POST /users with valid body returns 201', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'users.js',
      `
export default {
  route: "POST /users",
  schema: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: false,
        required: ["name"]
      }
    }
  },
  handler: async (params) => ({ statusCode: 201, body: { id: 1, name: params.body.name } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/users`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: 1, name: 'Alice' });
  });

  it('POST /users with invalid body returns 400', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'users.js',
      `
export default {
  route: "POST /users",
  schema: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: false,
        required: ["name"]
      }
    }
  },
  handler: async (params) => ({ statusCode: 201, body: { id: 1 } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/users`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('PATCH /users/:id with route parameter', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'user-patch.js',
      `
export default {
  route: "PATCH /users/:id",
  handler: async (params) => ({ statusCode: 200, body: { id: params.params.id } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/users/42`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('42');
  });

  it('query string handling', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'search.js',
      `
export default {
  route: "GET /search",
  handler: async (params) => ({ statusCode: 200, body: { q: params.query.q } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/search?q=test`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ q: 'test' });
  });

  it('allow-list enforcement rejects extra fields', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'strict.js',
      `
export default {
  route: "POST /strict",
  schema: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: false
      }
    }
  },
  handler: async (params) => ({ statusCode: 200, body: { ok: true } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/strict`, {
      method: 'POST',
      body: JSON.stringify({ name: 'ok', extra: 'bad' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('async error returns 500', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'fail.js',
      `
export default {
  route: "GET /fail",
  handler: async () => { throw new Error("fail"); }
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/fail`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('fail');
  });

  it('header validation - missing required header returns 400', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'auth.js',
      `
export default {
  route: "GET /auth",
  schema: {
    type: "object",
    properties: {
      headers: {
        type: "object",
        properties: { "x-api-key": { type: "string" } },
        required: ["x-api-key"],
        additionalProperties: false
      }
    }
  },
  handler: async (params) => ({ statusCode: 200, body: { ok: true } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/auth`);
    expect(res.status).toBe(400);
  });

  it('DELETE method works', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'delete.js',
      `
export default {
  route: "DELETE /items/:id",
  handler: async (params) => ({ statusCode: 200, body: { deleted: params.params.id } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/items/7`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: '7' });
  });

  it('PUT method works', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'update.js',
      `
export default {
  route: "PUT /items/:id",
  handler: async (params) => ({ statusCode: 200, body: { updated: params.params.id } })
};
`,
    );

    await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/items/3`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'new' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ updated: '3' });
  });

  it('close() stops the server', async () => {
    const port = await getFreePort();
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'health.js',
      `
export default {
  route: "GET /health",
  handler: async () => ({ statusCode: 200, body: { status: "ok" } })
};
`,
    );

    const server = await startServer(dir, port);

    const res = await fetch(`http://0.0.0.0:${port}/health`);
    expect(res.status).toBe(200);

    server.close();

    await expect(
      fetch(`http://0.0.0.0:${port}/health`),
    ).rejects.toThrow();
  });

  it('rejects when listening on a privileged port', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'health.js',
      `
export default {
  route: "GET /health",
  handler: async () => ({ statusCode: 200, body: { status: "ok" } })
};
`,
    );

    const handlers = await Router.loadHandlers(dir);

    const server2 = new Server(
      { port: 1, host: '0.0.0.0', handlersDir: dir },
      handlers,
    );
    await expect(server2.listen()).rejects.toThrow('Failed to listen');
  });
});
