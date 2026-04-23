import { getRuntimeMode, type RuntimeMode } from "./env.ts";

export type RuntimeModuleLoaders<T> = Record<RuntimeMode, () => T | Promise<T>>;

export function getRuntimeModule<T>(loaders: RuntimeModuleLoaders<T>): T | Promise<T> {
  return loaders[getRuntimeMode()]();
}

export { getRuntimeMode };
export type { RuntimeQueries } from "./contracts.ts";
export type { RuntimeMode } from "./env.ts";
