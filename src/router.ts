import { readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HandlerModule } from './types.js';

export class Router {
  static async loadHandlers(handlersDir: string): Promise<HandlerModule[]> {
    const dir = resolve(handlersDir);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      throw new Error(`Handlers directory not found: ${dir}`);
    }

    const moduleFiles = entries.filter(
      (f) => extname(f) === '.ts' || extname(f) === '.js',
    );

    const handlers: HandlerModule[] = [];

    for (const file of moduleFiles) {
      const filePath = resolve(dir, file);
      const fileUrl = pathToFileURL(filePath).href;

      let mod: unknown;
      try {
        mod = await import(fileUrl);
      } catch (err) {
        throw new Error(
          `Failed to load handler module "${file}": ${(err as Error).message}`,
        );
      }

      const handlerMod = (mod as { default?: HandlerModule }).default;

      if (!handlerMod) {
        throw new Error(
          `Handler module "${file}" does not have a default export`,
        );
      }

      if (typeof handlerMod.handler !== 'function') {
        throw new Error(
          `Handler module "${file}" is missing the "handler" property or it is not a function`,
        );
      }

      if (typeof handlerMod.route !== 'string' || handlerMod.route.length === 0) {
        throw new Error(
          `Handler module "${file}" has an invalid or missing "route" property`,
        );
      }

      const spaceIndex = handlerMod.route.indexOf(' ');
      if (spaceIndex === -1) {
        throw new Error(
          `Handler module "${file}" has an invalid route format: "${handlerMod.route}"`,
        );
      }

      const method = handlerMod.route.slice(0, spaceIndex).toUpperCase();
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!validMethods.includes(method)) {
        throw new Error(
          `Handler module "${file}" has an invalid HTTP method "${method}" in route "${handlerMod.route}"`,
        );
      }

      handlers.push(handlerMod);
    }

    return handlers;
  }
}
