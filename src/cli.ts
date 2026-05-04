#!/usr/bin/env node

import { Router } from './router.js';
import { Server } from './server.js';
import type { CliArgs } from './types.js';

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    port: 3000,
    host: '0.0.0.0',
    'handlers-dir': './handlers',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--port':
        args.port = parseInt(argv[++i], 10);
        break;
      case '--host':
        args.host = argv[++i];
        break;
      case '--handlers-dir':
        args['handlers-dir'] = argv[++i];
        break;
      default:
        break;
    }
  }

  return args;
}

async function main(args: CliArgs): Promise<void> {
  const handlers = await Router.loadHandlers(args['handlers-dir']);
  const server = new Server(
    { port: args.port, host: args.host, handlersDir: args['handlers-dir'] },
    handlers,
  );
  await server.listen();
  console.log(
    `Listening on http://${args.host}:${args.port}`,
  );
}

if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
  const argv = parseArgs(process.argv.slice(2));
  main(argv).catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
}

export { parseArgs, main };
