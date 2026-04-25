import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { FORBIDDEN_PATH, resolveAdminAccessFailure } from "@/lib/auth/admin-access";
import { isUserAdmin } from "@/lib/auth/admin-state";
import {
  getProtectedRedirectPath,
  getPostLoginRedirectPath,
  isPublicAuthPath
} from "@/lib/auth/redirects";
import { getRuntimeMode } from "@/lib/runtime";

export async function middleware(request: NextRequest) {
  if (getRuntimeMode() === "sqlite") {
    const { pathname, searchParams } = request.nextUrl;
    const isLoginPath = isPublicAuthPath(pathname);
    if (isLoginPath) {
      const nextPath = searchParams.get("next");
      return NextResponse.redirect(new URL(getPostLoginRedirectPath(nextPath), request.url));
    }

    return NextResponse.next({
      request
    });
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
          }

          response = NextResponse.next({
            request
          });

          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;
  const isLoginPath = isPublicAuthPath(pathname);
  const isPublicPath = isLoginPath || pathname === FORBIDDEN_PATH;

  if (!user && !isPublicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    return NextResponse.redirect(new URL(getProtectedRedirectPath(pathname), request.url));
  }

  if (user && isLoginPath) {
    const nextPath = searchParams.get("next");
    return NextResponse.redirect(new URL(getPostLoginRedirectPath(nextPath), request.url));
  }

  if (user && !isPublicPath) {
    const resolution = resolveAdminAccessFailure({
      pathname,
      isAuthenticated: true,
      isAdmin: await isUserAdmin(user.id),
      kind: pathname.startsWith("/api/") ? "api" : "page"
    });

    if (resolution.kind === "api-error") {
      return NextResponse.json({ error: resolution.message }, { status: resolution.status });
    }

    if (resolution.kind === "redirect") {
      return NextResponse.redirect(new URL(resolution.location, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
