import AjvDefault from 'ajv';
import type { JSONSchema, ValidatedRequestParams } from './types.js';

const AjvClass = AjvDefault as unknown as new (options?: Record<string, unknown>) => {
  compile(schema: Record<string, unknown>): (data: unknown) => boolean;
  errors: unknown;
};

export class ValidationError extends Error {
  public readonly details: unknown;

  constructor(message: string, details: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class SchemaValidator {
  private ajv: ReturnType<typeof SchemaValidator.createAjv>;

  private static createAjv() {
    return new AjvClass({
      allErrors: true,
      coerceTypes: false,
    });
  }

  constructor() {
    this.ajv = SchemaValidator.createAjv();
  }

  compile(schema: JSONSchema): (data: unknown) => boolean {
    return this.ajv.compile(schema as Record<string, unknown>);
  }

  validate(
    raw: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
      headers?: unknown;
    },
    validateFn: (data: unknown) => boolean,
  ): ValidatedRequestParams {
    const valid = validateFn(raw);
    if (!valid) {
      throw new ValidationError('Validation failed', this.ajv.errors);
    }

    return {
      body: raw.body,
      query: (raw.query ?? {}) as Record<string, string>,
      params: (raw.params ?? {}) as Record<string, string>,
      headers: (raw.headers ?? {}) as Record<string, string>,
    };
  }
}
