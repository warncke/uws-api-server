You are a TypeScript developer implementing the TECHNICAL SPECIFICATION.
Your task is to produce all the code and configuration files required to create an npm package that implements the specification exactly, with no deviations.

**General output requirements**

- Output every file needed for the package.
- Place each file in a separate fenced code block.
- Start each code block with a heading that shows the relative file path (e.g., `src/index.ts`).

**Project setup**

- Package type: ESM (`"type": "module"` in `package.json`).
- `package.json` must include:
  - `"version": "0.0.1"` (this is an initial AI‑generated module).
  - `"type": "module"`,
  - `"engines"` field set to `"node": ">=18"` (or a newer version if the specification explicitly requires it),
  - `"main": "./lib/index.js"`,
  - `"exports": "./lib/index.js"` (or a more detailed `exports` map if the specification defines multiple entry points).
- TypeScript with strict mode and modern ESM output. Two configuration files are used:

  **`tsconfig.json`** – used by IDEs and the language server; must **include all source and test files** (no `exclude` for tests):

  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "outDir": "lib",
      "rootDir": "src",
      "strict": true,
      "esModuleInterop": true,
      "declaration": true,
      "forceConsistentCasingInFileNames": true,
      "skipLibCheck": true,
      "isolatedModules": true
    },
    "include": ["src/**/*.ts"]
  }
  ```
  **Note on `isolatedModules`**: Required by `ts-jest` when using `module: "NodeNext"` or `module: "Node16"`. Without it, ts-jest will emit a warning for every test file.

  **`tsconfig.build.json`** – extends `tsconfig.json` and **excludes test files** so they are not emitted to `lib/` during the production build:

  ```json
  {
    "extends": "./tsconfig.json",
    "exclude": ["src/**/*.test.ts"]
  }
  ```

  The build script in `package.json` must point to this config:

  ```json
  "build": "tsc -p tsconfig.build.json"
  ```

- Directory structure:
  - TypeScript sources in `src/`.
  - Tests co‑located with the source file they test (e.g., `src/foo.ts` → test file `src/foo.test.ts`). All relative imports in source files must end with `.js` (the compiled output extension).
  - Compiled output goes to `lib/`.
- All other configuration files (`eslint.config.js`, `.prettierrc`, `jest.config.ts`, `.vscode/settings.json`, etc.) live at the project root.

- **VS Code workspace settings** – Create a `.vscode/settings.json` file to configure the TypeScript language server. It must use the current (non‑deprecated) settings:
  ```json
  {
    "js/ts.tsdk.path": "node_modules/typescript/lib",
    "js/ts.tsdk.promptToUseWorkspaceVersion": true
  }
  ```
  _Explanation_: `js/ts.tsdk.path` tells VS Code to use the local TypeScript installation for IntelliSense (ensuring consistency with the project’s version), and `js/ts.tsdk.promptToUseWorkspaceVersion` enables the prompt to switch to that version. These replaced the older `typescript.tsdk` and `typescript.enablePromptUseWorkspaceTsdk` keys.

**Linting & formatting**

- ESLint with the flat config format (`eslint.config.js`), using `@eslint/js` and `@typescript-eslint/eslint-plugin` with `@typescript-eslint/parser`.
  - The minimum required configuration file `eslint.config.js` is:

    ```js
    import js from "@eslint/js";
    import tsPlugin from "@typescript-eslint/eslint-plugin";
    import tsParser from "@typescript-eslint/parser";

    export default [
      js.configs.recommended,
      {
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
          },
        },
        plugins: {
          "@typescript-eslint": tsPlugin,
        },
        rules: {
          ...tsPlugin.configs.recommended.rules,
        },
      },
    ];
    ```

  - This enables `eslint:recommended` and `@typescript-eslint/recommended` for TypeScript files.
  - **Critical**: Test files need `globals.jest` in `languageOptions.globals` so ESLint recognizes Jest globals (`describe`, `it`, `afterEach`, `expect`, etc.). Without this, ESLint's `no-undef` will error on every test file. Use a separate config entry scoped to `src/**/*.test.ts`.
  - **Critical**: Add `'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]` to the rules. Without this, handler parameters prefixed with `_` (used when the handler does not use `params`) will cause lint failures.

- Prettier with `.prettierrc`:

  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all"
  }
  ```

  - Include a `.prettierignore` that ignores `lib/`, `node_modules/`, `coverage/`.

**Testing & Coverage**

- Jest with `ts-jest` and full ESM support.
- Configuration in a separate `jest.config.ts` file (not inside `package.json`):
- **Test files that use `import()`** (e.g., tests for `Router.loadHandlers`): Handler files written to temp directories must have a `package.json` with `{"type": "module"}` written alongside them. Without this, Node.js treats `.js` files outside the project root as CommonJS and fails on `export default` syntax. Tests must also use `NODE_OPTIONS='--experimental-vm-modules'` (configured in the `test` script, not in `jest.config.ts`).
- **uWS integration tests**: Use `uWS.us_listen_socket_close(listenSocket)` to shut down servers in `afterEach`. The `listenSocket` must be imported as `import uWS, { us_listen_socket } from 'uWebSockets.js'` (not typed as `unknown`). **Never call `close()` twice on the same listen socket** — uWS will segfault. Always clear the reference after closing (e.g., `this.listenSocket = undefined`).
- Configuration in a separate `jest.config.ts` file (not inside `package.json`):

  ```ts
  import type { Config } from "jest";

  const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    transform: {
      "^.+\\.ts$": ["ts-jest", { useESM: true }],
    },
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: {
      "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    collectCoverage: false, // enabled only via the "coverage" script
    coverageDirectory: "coverage",
    coverageReporters: ["json-summary", "text-summary"],
    coverageThreshold: {
      global: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  };

  export default config;
  ```

- **The coverage thresholds are non‑negotiable.** The `coverageThreshold` values in `jest.config.ts` must be exactly as specified above for all four metrics (90). Do not change these numbers, even if achieving the threshold is difficult. If coverage is insufficient, you must add more tests—never lower the thresholds.
- Every source file that exports functions, classes, or constants that are testable **must** have a corresponding test file.  
  **Naming rule:** add `.test` immediately before the `.ts` extension.  
  _Examples:_
  - `src/foo.ts` → `src/foo.test.ts`
  - `src/bar.helper.ts` → `src/bar.helper.test.ts`
- **Coverage thresholds** are enforced at 90% for all metrics. Jest will exit with code 1 if coverage falls below the threshold **even if all tests pass**. The agent must treat a non‑zero exit from `npm run coverage` as a failure that must be addressed.
- The `coverage` script is simply:
  ```
  "coverage": "jest --coverage"
  ```
  Running `npm run coverage` will:
  - Print a human‑readable text summary to the console.
  - Write a machine‑readable JSON summary to `coverage/coverage-summary.json`.

**Dependencies & scripts**

- `package.json` scripts:
  ```json
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest --forceExit --maxWorkers=1 --no-cache",
    "coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage --forceExit --maxWorkers=1 --no-cache",
    "lint": "eslint src/",
    "format": "prettier --write .",
    "prepare": "npm run build"
  }
  ```
  **Notes on flags**:
  - `NODE_OPTIONS='--experimental-vm-modules'` — Required for Jest to handle ESM `import()` calls natively. Without this, dynamic `import(fileUrl)` in production code (e.g., `Router.loadHandlers`) will fail inside Jest's CJS sandbox.
  - `--forceExit` — Required when using native addons like `uWebSockets.js`. uWS creates native sockets that keep the Node.js event loop alive after tests finish; without this flag Jest hangs indefinitely.
  - `--maxWorkers=1 --no-cache` — Required because uWS's native addon segfaults when multiple test files load it in parallel V8 contexts.
- Required devDependencies: `@types/node`, `@types/jest`, `eslint`, `@eslint/js`, `prettier`, `typescript`, `jest`, `ts-jest`, `ts-node`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`.  
  **Warning**: `ts-node` is required at build time by Jest to parse `jest.config.ts` in ESM mode; without it the test suite will fail to start.
  Run the following command for each package to install the latest version and pin it exactly in `package.json`:
  ```
  npm install --save-dev --save-exact <package>@latest
  ```
  Example:
  ```
  npm install --save-dev --save-exact typescript@latest
  ```
  The final `package.json` must contain each devDependency with an exact version (no `^` or `~`).
- Include a `.gitignore` file containing at minimum:
  ```
  node_modules/
  lib/
  *.db
  .env
  coverage/
  dist/
  .DS_Store
  ```

**Code structure**

- Place each logical component described in the specification (a class, a set of utility functions, a type namespace) in its own file inside `src/`. Name files after the component they contain (e.g., `src/config.ts`, `src/session-manager.ts`).
- The main entry point is `src/index.ts`. It must export all public API elements; if the specification describes a CLI tool, implement the binary entry point here and set `"bin"` in `package.json`.

**README.md generation**
You must produce a `README.md` file that is **developer‑focused**, but also provides clear **end‑user instructions** at the top.

- Use the following **required sections** in this order:
  1. **Title & one‑line description** — taken from the spec's Overview section.
  2. **Usage** — Instructions for end‑users to run the package directly (without cloning).
     - Show how to run with `npx` (or global install) using the package name derived from the spec or generated `package.json`.
     - Include a minimal example with the required flags (if any).
     - If the package is a library, show an import snippet instead.
     - **Configuration** — insert a table of CLI arguments, environment variables, or configuration options described in the spec directly under the usage instructions.
  3. **Development** — How to set up the project for local development.
     - `git clone <repository-url>` (you may use `<repository-url>` as the only placeholder allowed in the entire README, since the spec never provides a repository address).
     - `cd <package-name>`, `npm install`, `npm run build`, and any other initial steps.
  4. **Development Workflow** — commands: `npm install`, `npm run build`, `npm test`, `npm run coverage`, `npm run lint`, `npm run format`, `npm run prepare`. Explain each briefly.
  5. **Testing Guidelines** — derived from the spec's testing requirements and the `jest.config.ts` configuration. Include notes on mocking strategy, in‑memory databases, and coverage thresholds.
  6. **AI Usage in Development** — Explain how AI tools are used in this project's development workflow. Include:
     - **Tools**: Visual Studio Code, Cline (and its fork Dirac), DeepSeek (via API and open‑weights models hosted by providers like NVIDIA and HuggingFace).
     - **Key files**:
       - `technical-specification.md` – the complete system design specification that drives all implementation.
       - `instantiation.md` – (if present in the project) additional instantiation‑specific details.
     - **Specification creation**: Mention that the `technical-specification.md` was generated iteratively using an "Interactive System Design Agent" prompt (reproduced in a prompts directory if present). Explain that this prompt enables a conversational design loop, producing the specification, diagrams, and testing plan.
     - **Development loop**: Describe the cycle of refining the specification with the design agent, then handing the final spec to a coding agent (via Cline/Dirac) to generate the full package, run tests, and meet coverage thresholds.
     - **Model hosting**: Note that open‑weights DeepSeek models can be run via US‑based inference endpoints (e.g., NVIDIA NIM, HuggingFace Inference Endpoints) for lower latency or data residency.
     - Keep this section concise; it should explain the methodology without duplicating the full prompts.
  7. **Contributing** — rules: stick to the technical specification, follow the linting and formatting setup, ensure tests pass and coverage thresholds are met before committing.
- You MUST **not** copy any hard‑coded README text from this prompt. Instead, extract the actual values (e.g., package name, commands, options, defaults) from the technical specification and the generated project files.
- The README must be valid Markdown, with fenced code blocks where appropriate.
- Do not include any placeholder text like `[TODO]` or `[TBD]` — fill everything using information from the spec. The **only exception** is `<repository-url>` in the Development clone command.
- If the spec does not provide enough detail for a section, include the section with a brief sentence indicating the topic and skip the missing details rather than inventing them.
- **Do not** include a "Project Structure" section or a file tree diagram.

**Post‑generation verification**
After all files have been written, you must perform the following steps in order:

1. Run `npm install` to install all dependencies (if they haven’t been installed yet).
2. Run `npm run build` to compile the TypeScript code. Fix any compilation errors until the build succeeds.
3. Run `npm run coverage` to execute all tests with coverage collection.
   - If any test fails, fix the implementation or the test (without deviating from the specification) until all tests pass.
   - If all tests pass but the process exits with code 1, the coverage threshold is not met. Analyse the uncovered lines reported in the console output or in `coverage/coverage-summary.json`. Add focused tests that exercise the uncovered code paths without altering the specification’s behaviour.
4. Repeat step 3 until `npm run coverage` exits with code 0.

You may not alter the specification’s required behaviour, but you are expected to achieve full compliance with the 90% coverage threshold. Once the coverage check passes, your task is complete.

**Execution**

- Read the entire technical specification file before writing any code.
- Implement precisely what the specification describes. Do not add, remove, or alter any behaviour beyond what is explicitly stated.
- Output every generated file in a separate fenced code block with a clear relative path heading.

**Known gotchas (from previous runs)**

1. **Ajv import with NodeNext** — `import Ajv from 'ajv'` does NOT work as a type with `module: "NodeNext"`. The default export resolves to the module namespace, not the class constructor. Use:
   ```ts
   import AjvDefault from 'ajv';
   const AjvClass = AjvDefault as unknown as new (opts?: Record<string, unknown>) => {
     compile(schema: Record<string, unknown>): (data: unknown) => boolean;
     errors: unknown;
   };
   ```
   Then instantiate with `new AjvClass({...})`.

2. **uWS `getParameter` can return `undefined`** — Always use `req.getParameter(i) ?? ''` for route parameter extraction; the type definition marks it as `string | undefined`.

3. **uWS `us_listen_socket` type** — The `listen` callback's `token` parameter is typed `us_listen_socket | false`. Import the type:
   ```ts
   import uWS, { us_listen_socket } from 'uWebSockets.js';
   ```
   Store the socket as `us_listen_socket | undefined` (not `unknown`). Pass it to `uWS.us_listen_socket_close()` with the correct type.

4. **Dynamic import in `Router.loadHandlers`** — Use `await import(fileUrl)` with `pathToFileURL(resolve(dir, file)).href`. This works with Node.js native ESM without issues in production. For tests, ensure `NODE_OPTIONS='--experimental-vm-modules'` is set.

5. **Defensive catch in `AsyncBridge.processRequest`** — All errors are caught internally (handler errors → 500, validation errors → 400, write failures → ignored). The `.catch()` on the `processRequest` call and non-`ValidationError` branches in the validation catch are dead code and should be omitted to avoid coverage gaps. The spec does not require them.

```

```
