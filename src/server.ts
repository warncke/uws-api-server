import uWS, { us_listen_socket } from 'uWebSockets.js';
import type { ServerConfig, HandlerModule } from './types.js';
import { parseRoute } from './parse-route.js';
import { SchemaValidator } from './schema-validator.js';
import { AsyncBridge } from './async-bridge.js';

export class Server {
  private app: uWS.TemplatedApp;
  private listenSocket: us_listen_socket | undefined;

  constructor(
    private readonly config: ServerConfig,
    private readonly handlers: HandlerModule[],
  ) {
    this.app = uWS.App();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    const schemaValidator = new SchemaValidator();

    for (const handler of this.handlers) {
      const { method, path, paramNames } = parseRoute(handler.route);
      const bridge = new AsyncBridge(schemaValidator, handler, paramNames);

      switch (method) {
        case 'GET':
          this.app.get(path, (res, req) => bridge.handle(res, req));
          break;
        case 'POST':
          this.app.post(path, (res, req) => bridge.handle(res, req));
          break;
        case 'PUT':
          this.app.put(path, (res, req) => bridge.handle(res, req));
          break;
        case 'PATCH':
          this.app.patch(path, (res, req) => bridge.handle(res, req));
          break;
        case 'DELETE':
          this.app.del(path, (res, req) => bridge.handle(res, req));
          break;
      }
    }
  }

  async listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(this.config.host, this.config.port, (token) => {
        if (token) {
          this.listenSocket = token;
          resolve();
        } else {
          reject(
            new Error(
              `Failed to listen on ${this.config.host}:${this.config.port}`,
            ),
          );
        }
      });
    });
  }

  close(): void {
    if (this.listenSocket) {
      uWS.us_listen_socket_close(this.listenSocket);
      this.listenSocket = undefined;
    }
  }
}
