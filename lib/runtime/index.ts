import { getRuntimeMode, type RuntimeMode } from "./env.ts";
import type { RuntimeQueries } from "./contracts.ts";

export type RuntimeModuleLoaders<T> = Record<RuntimeMode, () => T | Promise<T>>;

export function getRuntimeModule<T>(loaders: RuntimeModuleLoaders<T>): T | Promise<T> {
  return loaders[getRuntimeMode()]();
}

export async function getRuntimeQueries(): Promise<RuntimeQueries> {
  const runtimeMode = getRuntimeMode();

  if (runtimeMode === "sqlite") {
    return (await import(`./${runtimeMode}/queries.ts`)) as RuntimeQueries;
  }

  return (await import("./supabase/queries.ts")) as RuntimeQueries;
}

export { getRuntimeMode };
export type { RuntimeQueries } from "./contracts.ts";
export type { RuntimeMode } from "./env.ts";
