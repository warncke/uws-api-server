import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { parseArgs, main } from './cli.js';

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

describe('parseArgs', () => {
  it('returns defaults when no args provided', () => {
    const args = parseArgs([]);
    expect(args.port).toBe(3000);
    expect(args.host).toBe('0.0.0.0');
    expect(args['handlers-dir']).toBe('./handlers');
  });

  it('parses --port', () => {
    const args = parseArgs(['--port', '8080']);
    expect(args.port).toBe(8080);
  });

  it('parses --host', () => {
    const args = parseArgs(['--host', '127.0.0.1']);
    expect(args.host).toBe('127.0.0.1');
  });

  it('parses --handlers-dir', () => {
    const args = parseArgs(['--handlers-dir', './api']);
    expect(args['handlers-dir']).toBe('./api');
  });

  it('parses all args together', () => {
    const args = parseArgs([
      '--port',
      '9090',
      '--host',
      '0.0.0.0',
      '--handlers-dir',
      './my-handlers',
    ]);
    expect(args.port).toBe(9090);
    expect(args.host).toBe('0.0.0.0');
    expect(args['handlers-dir']).toBe('./my-handlers');
  });

  it('ignores unknown flags', () => {
    const args = parseArgs(['--unknown', 'value', '--port', '4000']);
    expect(args.port).toBe(4000);
    expect(args.host).toBe('0.0.0.0');
  });
});

describe('main', () => {
  it('starts and stops a server', async () => {
    const port = await getFreePort();
    const dir = mkdtempSync(join(tmpdir(), 'cli-main-test-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(
      join(dir, 'health.js'),
      `
export default {
  route: "GET /health",
  handler: async () => ({ statusCode: 200, body: { status: "ok" } })
};
`,
      'utf-8',
    );

    await main({ port, host: '0.0.0.0', 'handlers-dir': dir });

    const res = await fetch(`http://0.0.0.0:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
