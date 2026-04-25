import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { resolveAdminAccessFailure } from "../auth/admin-access.ts";
import { getRuntimeMode } from "./env.ts";

type RuntimeAdminFlags = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

async function getRuntimeAuthModule() {
  const runtimeMode = getRuntimeMode();
  return import(`./${runtimeMode}/auth.ts`);
}

export async function getRuntimeAdminFlags(): Promise<RuntimeAdminFlags> {
  const runtimeAuth = await getRuntimeAuthModule();
  return runtimeAuth.getAdminFlags();
}

export async function requireRuntimeAdminAction(pathname: string) {
  const resolution = resolveAdminAccessFailure({
    pathname,
    kind: "action",
    ...(await getRuntimeAdminFlags())
  });

  if (resolution.kind === "allow") {
    return;
  }

  if (resolution.kind === "api-error") {
    throw new Error(resolution.message);
  }

  redirect(resolution.location);
}

export async function requireRuntimeAdminApiAccess(pathname: string) {
  const resolution = resolveAdminAccessFailure({
    pathname,
    kind: "api",
    ...(await getRuntimeAdminFlags())
  });

  if (resolution.kind === "allow") {
    return null;
  }

  if (resolution.kind === "api-error") {
    return NextResponse.json(
      { error: resolution.message },
      { status: resolution.status }
    );
  }

  return null;
}
