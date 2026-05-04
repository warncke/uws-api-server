import { SchemaValidator, ValidationError } from './schema-validator.js';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('validates a correct request envelope', () => {
    const schema = {
      type: 'object',
      properties: {
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
        },
      },
    };

    const validateFn = validator.compile(schema);
    const result = validator.validate(
      { body: { name: 'Alice' } },
      validateFn,
    );

    expect(result).toEqual({
      body: { name: 'Alice' },
      query: {},
      params: {},
      headers: {},
    });
  });

  it('rejects unknown properties (allow-list)', () => {
    const schema = {
      type: 'object',
      properties: {
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
        },
      },
    };

    const validateFn = validator.compile(schema);
    expect(() =>
      validator.validate({ body: { name: 'ok', extra: true } }, validateFn),
    ).toThrow(ValidationError);
  });

  it('passes through missing optional segments without validation', () => {
    const schema = {
      type: 'object',
      properties: {
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
        },
      },
    };

    const validateFn = validator.compile(schema);
    const result = validator.validate(
      { body: { name: 'Alice' }, query: { search: 'test' } },
      validateFn,
    );

    expect(result.query).toEqual({ search: 'test' });
    expect(result.body).toEqual({ name: 'Alice' });
  });

  it('validates query parameters', () => {
    const schema = {
      type: 'object',
      properties: {
        query: {
          type: 'object',
          properties: { q: { type: 'string' } },
          additionalProperties: false,
        },
      },
    };

    const validateFn = validator.compile(schema);
    expect(() =>
      validator.validate({ query: { q: 'test', extra: 'bad' } }, validateFn),
    ).toThrow(ValidationError);
  });

  it('returns empty objects for undefined segments', () => {
    const schema = {
      type: 'object',
      properties: {},
    };

    const validateFn = validator.compile(schema);
    const result = validator.validate({}, validateFn);

    expect(result.body).toBeUndefined();
    expect(result.query).toEqual({});
    expect(result.params).toEqual({});
    expect(result.headers).toEqual({});
  });

  it('ValidationError has correct properties', () => {
    try {
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
      const validateFn = validator.compile(schema);
      validator.validate({ body: {} }, validateFn);
    } catch (err) {
      if (err instanceof ValidationError) {
        expect(err.message).toBe('Validation failed');
        expect(err.details).toBeDefined();
        expect(err.name).toBe('ValidationError');
      } else {
        throw err;
      }
    }
  });
});
