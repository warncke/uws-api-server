# uws-api-server

A thin, async-friendly wrapper around uWebSockets.js that bridges uWS's native callback-based API into regular async/await handlers, enforces JSON Schema validation as an allow-list for every request, and ships with ready-to-use PM2 and systemd configuration files for production deployment.

## Usage

### Run directly via npx

```bash
npx uws-api-server --port 3000 --handlers-dir ./handlers
```

### Or install globally

```bash
npm install -g uws-api-server
uws-api-server --port 8080 --handlers-dir ./api-handlers
```

### CLI Arguments

| Argument         | Default        | Description                          |
|------------------|----------------|--------------------------------------|
| `--port`         | `3000`         | HTTP port to bind                    |
| `--host`         | `0.0.0.0`      | Bind address                         |
| `--handlers-dir` | `./handlers`   | Path to the flat directory of handlers |

### Handler Module Format

Each file in the handlers directory must export a default object with:

```typescript
interface HandlerModule {
  route: string; // "METHOD /path" e.g. "GET /health", "POST /users/:id"
  schema?: {    // optional JSON Schema for request validation
    body?: object;
    query?: object;
    params?: object;
    headers?: object;
  };
  handler: (params: ValidatedRequestParams) => Promise<HandlerResponse>;
}
```

Example `handlers/health.js`:

```js
export default {
  route: "GET /health",
  handler: async () => ({ statusCode: 200, body: { status: "ok" } })
};
```

### Library Usage

```typescript
import { Router, Server } from 'uws-api-server';

const handlers = await Router.loadHandlers('./handlers');
const server = new Server({ port: 3000, host: '0.0.0.0', handlersDir: './handlers' }, handlers);
await server.listen();
```

## Development

```bash
git clone <repository-url>
cd uws-api-server
npm install
npm run build
```

## Development Workflow

| Command             | Description                                      |
|---------------------|--------------------------------------------------|
| `npm install`       | Install all dependencies                         |
| `npm run build`     | Compile TypeScript to `lib/`                     |
| `npm test`          | Run all tests with Jest                          |
| `npm run coverage`  | Run tests with coverage (90% threshold required) |
| `npm run lint`      | Lint source files with ESLint                    |
| `npm run format`    | Format code with Prettier                        |
| `npm run prepare`   | Build before publish (npm lifecycle hook)        |

## Testing Guidelines

- **Unit tests** are co-located with source files (`src/foo.ts` → `src/foo.test.ts`).
- **Integration tests** spin up a real uWS server on a dynamic port and issue HTTP requests using Node.js built-in `fetch`.
- **Coverage threshold**: 90% minimum on branches, functions, lines, and statements.
- **Mocking**: Handler files are written to temporary directories and imported dynamically. No mocking framework is used for uWS — tests run against the real library.
- Run `npm run coverage` to check coverage; the process exits with code 1 if thresholds are not met.

## AI Usage in Development

This project was developed using AI-assisted tooling:

- **Tools**: Visual Studio Code, Cline (and its fork Dirac), DeepSeek (via API and open-weights models hosted by providers such as NVIDIA and HuggingFace).
- **Key files**:
  - `technical-specifications.md` — the complete system design specification that drives all implementation.
  - `instantiate.md` — instantiation-specific details for the AI agent.
- **Specification creation**: The `technical-specifications.md` was generated iteratively using an Interactive System Design Agent prompt. This prompt enables a conversational design loop, producing the specification, diagrams, and testing plan.
- **Development loop**: The specification is refined with the design agent, then handed to a coding agent (via Cline/Dirac) to generate the full package, run tests, and meet coverage thresholds.
- **Model hosting**: Open-weights DeepSeek models can be run via US-based inference endpoints (e.g., NVIDIA NIM, HuggingFace Inference Endpoints) for lower latency or data residency requirements.

## Contributing

- Stick to the technical specification (`technical-specifications.md`).
- Follow the linting and formatting setup (`npm run lint`, `npm run format`).
- Ensure all tests pass and coverage thresholds are met before committing.
