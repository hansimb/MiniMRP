export type RuntimeMode = "supabase" | "sqlite";

export function getRuntimeMode(): RuntimeMode {
  const runtimeMode = process.env.MINIMRP_RUNTIME;

  if (runtimeMode === undefined) {
    return "supabase";
  }

  if (runtimeMode === "supabase" || runtimeMode === "sqlite") {
    return runtimeMode;
  }

  throw new Error(`Unsupported MINIMRP_RUNTIME value: ${runtimeMode}`);
}
