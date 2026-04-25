import { Suspense } from "react";
import { getRuntimeMode } from "@/lib/runtime";
import { getPostLoginRedirectPath } from "@/lib/auth/redirects";
import { LoginPageClient } from "./login-page-client";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  if (getRuntimeMode() === "sqlite") {
    redirect(getPostLoginRedirectPath(null));
  }

  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  );
}
