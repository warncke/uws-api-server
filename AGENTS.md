# uws-api-server

A thin, async-friendly wrapper around uWebSockets.js.

## Project Structure

- `src/` — TypeScript source files
- `deploy/` — PM2 ecosystem file and systemd unit
- `lib/` — Compiled JavaScript output (gitignored)
- `coverage/` — Test coverage reports (gitignored)

## Key Files

| File | Purpose |
|---|---|
| `technical-specification.md` | System design specification |
| `system-design-prompt.md` | Interactive system design agent prompt |
| `instantiate.md` | AI instantiation instructions for implementing the spec |
| `src/index.ts` | Main entry point / public API |
| `src/cli.ts` | CLI entry point (`uws-api-server`) |
| `src/server.ts` | uWS Server class |
| `src/router.ts` | Handler module loader |
| `src/async-bridge.ts` | uWS callback-to-async bridge |
| `src/schema-validator.ts` | AJV schema validation wrapper |
| `src/parse-route.ts` | Route string parser |
| `src/types.ts` | Shared type definitions |

## Commands

```bash
npm run build     # Compile TypeScript to lib/
npm test          # Run tests
npm run coverage  # Run tests with coverage (90% threshold)
npm run lint      # ESLint
npm run format    # Prettier
```

## Notes

- ESM package (`"type": "module"`)
- Depends on `uWebSockets.js` and `ajv` only
- Tests use real uWS servers on dynamic ports
