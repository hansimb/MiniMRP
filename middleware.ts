import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidDemoAccessToken } from "@/lib/demo-security/auth";
import {
  DEMO_ACCESS_COOKIE,
  DEMO_ACCESS_ROUTE,
  getDemoPassword
} from "@/lib/demo-security/config";
import {
  consumeRateLimit,
  createRateLimitStore
} from "@/lib/demo-security/rate-limit";

const rateLimitStore = createRateLimitStore();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function applyRateLimit(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);
  const now = Date.now();

  if (request.method === "POST" && pathname !== DEMO_ACCESS_ROUTE) {
    return consumeRateLimit({
      store: rateLimitStore,
      key: `write:${ip}`,
      now,
      maxRequests: 20,
      windowMs: 60_000
    });
  }

  if (request.method === "GET" && pathname.startsWith("/api/export/")) {
    return consumeRateLimit({
      store: rateLimitStore,
      key: `export:${ip}`,
      now,
      maxRequests: 30,
      windowMs: 60_000
    });
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.next();
  }

  const rateLimitResult = applyRateLimit(request);
  if (rateLimitResult && !rateLimitResult.allowed) {
    return new NextResponse("Too many requests for this demo. Please wait a moment.", {
      status: 429,
      headers: {
        "retry-after": String(Math.ceil(rateLimitResult.retryAfterMs / 1000))
      }
    });
  }

  if (pathname === DEMO_ACCESS_ROUTE) {
    return NextResponse.next();
  }

  const token = request.cookies.get(DEMO_ACCESS_COOKIE)?.value;
  if (isValidDemoAccessToken(token, getDemoPassword())) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = DEMO_ACCESS_ROUTE;
  url.search = "";
  return NextResponse.redirect(url);

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
