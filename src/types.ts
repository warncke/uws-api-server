export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface JSONSchema {
  [key: string]: unknown;
}

export interface ValidatedRequestParams {
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
}

export interface HandlerResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HandlerModule {
  route: string;
  schema?: JSONSchema;
  handler: (params: ValidatedRequestParams) => Promise<HandlerResponse>;
}

export interface ServerConfig {
  port: number;
  host: string;
  handlersDir: string;
}

export interface CliArgs {
  port: number;
  host: string;
  'handlers-dir': string;
}
