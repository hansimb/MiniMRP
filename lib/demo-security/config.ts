export const DEMO_ACCESS_COOKIE = "mini_demo_access";
export const DEMO_ACCESS_ROUTE = "/demo-access";
export const DEFAULT_DEMO_PASSWORD = "demo123";

export function getDemoPassword() {
  return process.env.DEMO_ACCESS_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
}
