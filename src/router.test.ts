import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Router } from './router.js';

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'router-test-'));
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

describe('Router', () => {
  it('loads a directory of valid handler modules', async () => {
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
        additionalProperties: false
      }
    }
  },
  handler: async () => ({ statusCode: 201, body: { id: 1 } })
};
`,
    );

    const handlers = await Router.loadHandlers(dir);
    expect(handlers).toHaveLength(2);
    expect(handlers[0].route).toBe('GET /health');
    expect(handlers[1].route).toBe('POST /users');
  });

  it('rejects a module with an invalid route string', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'bad.js',
      `
export default {
  route: "INVALID /path",
  handler: async () => ({ statusCode: 200 })
};
`,
    );

    await expect(Router.loadHandlers(dir)).rejects.toThrow(
      'invalid HTTP method',
    );
  });

  it('rejects a module missing the handler property', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'no-handler.js',
      `
export default {
  route: "GET /test"
};
`,
    );

    await expect(Router.loadHandlers(dir)).rejects.toThrow(
      'missing the "handler" property',
    );
  });

  it('rejects a module with no default export', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'no-default.js',
      `
export const foo = "bar";
`,
    );

    await expect(Router.loadHandlers(dir)).rejects.toThrow(
      'does not have a default export',
    );
  });

  it('rejects a module with empty route', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'empty-route.js',
      `
export default {
  route: "",
  handler: async () => ({ statusCode: 200 })
};
`,
    );

    await expect(Router.loadHandlers(dir)).rejects.toThrow(
      'invalid or missing "route"',
    );
  });

  it('rejects a module with route missing space', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'bad-route.js',
      `
export default {
  route: "GETPATH",
  handler: async () => ({ statusCode: 200 })
};
`,
    );

    await expect(Router.loadHandlers(dir)).rejects.toThrow(
      'invalid route format',
    );
  });

  it('throws if handlers directory does not exist', async () => {
    await expect(
      Router.loadHandlers('/nonexistent/directory'),
    ).rejects.toThrow('Handlers directory not found');
  });

  it('skips non-js/ts files', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'health.js',
      `
export default {
  route: "GET /health",
  handler: async () => ({ statusCode: 200 })
};
`,
    );

    writeFileSync(join(dir, 'notes.txt'), 'not a handler', 'utf-8');
    writeFileSync(join(dir, 'data.json'), '{}', 'utf-8');

    const handlers = await Router.loadHandlers(dir);
    expect(handlers).toHaveLength(1);
    expect(handlers[0].route).toBe('GET /health');
  });

  it('throws on module that fails during import', async () => {
    const dir = createTempDir();

    writeHandlerFile(
      dir,
      'broken.js',
      `throw new Error("import failed");`,
    );

    await expect(Router.loadHandlers(dir)).rejects.toThrow(
      'Failed to load handler module',
    );
  });
});
