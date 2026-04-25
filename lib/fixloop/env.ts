function isFixLoopEnabled() {
  const rawValue = process.env.ENABLE_FIXLOOP?.trim().toLowerCase();
  return rawValue === "true" || rawValue === "1" || rawValue === "yes";
}

export function getFixLoopBrowserEnv() {
  const projectName =
    process.env.AGENTIC_FIX_LOOP_PROJECT_NAME ??
    process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_PROJECT_NAME;
  const url = process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_AGENTIC_FIX_LOOP_SUPABASE_ANON_KEY;

  return {
    projectName,
    url,
    anonKey
  };
}

export function hasFixLoopBrowserEnv() {
  if (!isFixLoopEnabled()) {
    return false;
  }

  const env = getFixLoopBrowserEnv();

  return Boolean(env.projectName && env.url && env.anonKey);
}
