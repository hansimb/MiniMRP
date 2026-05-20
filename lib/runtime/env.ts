export type RuntimeMode = "supabase" | "sqlite";

function resolveRuntimeMode(runtimeMode: string | undefined): RuntimeMode {
  if (runtimeMode === undefined && process.env.MINIMRP_DESKTOP_RUNTIME === "1") {
    return "sqlite";
  }

  if (runtimeMode === undefined) {
    return "supabase";
  }

  if (runtimeMode === "supabase" || runtimeMode === "sqlite") {
    return runtimeMode;
  }

  throw new Error(`Unsupported MINIMRP_RUNTIME value: ${runtimeMode}`);
}

export function getServerRuntimeMode(): RuntimeMode {
  return resolveRuntimeMode(process.env.MINIMRP_RUNTIME);
}

export function getBrowserRuntimeMode(): RuntimeMode {
  if (process.env.MINIMRP_DESKTOP_RUNTIME === "1") {
    return "sqlite";
  }

  return resolveRuntimeMode(
    process.env.NEXT_PUBLIC_MINIMRP_RUNTIME ??
      process.env.MINIMRP_RUNTIME
  );
}

export function getRuntimeMode(): RuntimeMode {
  return getServerRuntimeMode();
}
