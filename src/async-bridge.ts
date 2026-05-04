import type { HttpRequest, HttpResponse } from 'uWebSockets.js';
import type {
  HandlerModule,
  HandlerResponse,
  ValidatedRequestParams,
} from './types.js';
import { SchemaValidator, ValidationError } from './schema-validator.js';

export class AsyncBridge {
  private validateFn?: (data: unknown) => boolean;
  private handler: (
    params: ValidatedRequestParams,
  ) => Promise<HandlerResponse>;
  private routeParams: string[];

  constructor(
    private readonly schemaValidator: SchemaValidator,
    handlerModule: HandlerModule,
    routeParams: string[],
  ) {
    if (handlerModule.schema) {
      this.validateFn = schemaValidator.compile(handlerModule.schema);
    }
    this.handler = handlerModule.handler;
    this.routeParams = routeParams;
  }

  handle(res: HttpResponse, req: HttpRequest): void {
    let aborted = false;
    const chunks: Buffer[] = [];

    res.onAborted(() => {
      aborted = true;
    });

    const headers: Record<string, string> = {};
    req.forEach((key, value) => {
      headers[key] = value;
    });

    const queryString = req.getQuery();
    const query: Record<string, string> = {};
    if (queryString) {
      for (const part of queryString.split('&')) {
        const eqIndex = part.indexOf('=');
        if (eqIndex !== -1) {
          query[decodeURIComponent(part.slice(0, eqIndex))] =
            decodeURIComponent(part.slice(eqIndex + 1));
        } else {
          query[decodeURIComponent(part)] = '';
        }
      }
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < this.routeParams.length; i++) {
      params[this.routeParams[i]] = req.getParameter(i) ?? '';
    }

    res.onData((chunk, isLast) => {
      if (aborted) return;

      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      if (isLast) {
        const rawBody = Buffer.concat(chunks);
        let body: unknown = undefined;
        if (rawBody.length > 0) {
          try {
            body = JSON.parse(rawBody.toString());
          } catch {
            body = rawBody.toString();
          }
        }

        const raw = { body, query, params, headers };

        this.processRequest(raw, res).catch(() => {});
      }
    });
  }

  private async processRequest(
    raw: {
      body?: unknown;
      query: Record<string, string>;
      params: Record<string, string>;
      headers: Record<string, string>;
    },
    res: HttpResponse,
  ): Promise<void> {
    let validParams: ValidatedRequestParams;

    if (this.validateFn) {
      try {
        validParams = this.schemaValidator.validate(raw, this.validateFn);
      } catch (err) {
        if (err instanceof ValidationError) {
          try {
            res.writeStatus('400 Bad Request');
            res.end(
              JSON.stringify({
                error: 'Validation failed',
                details: err.details,
              }),
            );
          } catch {
            // ignore
          }
        }
        return;
      }
    } else {
      validParams = raw as ValidatedRequestParams;
    }

    let result: HandlerResponse;
    try {
      result = await this.handler(validParams);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      try {
        res.writeStatus('500 Internal Server Error');
        res.end(JSON.stringify({ error: message }));
      } catch {
        // ignore
      }
      return;
    }

    const statusCode = result.statusCode ?? 200;
    const responseHeaders: Record<string, string> = {
      ...(result.headers ?? {}),
    };

    if (result.body === undefined) {
      try {
        res.writeStatus(String(statusCode));
        for (const [key, value] of Object.entries(responseHeaders)) {
          res.writeHeader(key, value);
        }
        res.end();
      } catch {
        // ignore
      }
    } else {
      const bodyStr = JSON.stringify(result.body);
      if (!responseHeaders['content-type']) {
        responseHeaders['content-type'] = 'application/json';
      }
      try {
        res.writeStatus(String(statusCode));
        for (const [key, value] of Object.entries(responseHeaders)) {
          res.writeHeader(key, value);
        }
        res.end(bodyStr);
      } catch {
        // ignore
      }
    }
  }
}
