"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPostLoginRedirectPath } from "@/lib/auth/redirects";
import { createRuntimeBrowserClient } from "@/lib/runtime/browser-client";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="login-shell">
      <section className="login-copy">
        <span className="login-eyebrow">MiniMRP Internal Access</span>
        <h1>Sign in to the admin workspace</h1>
        <p>
          Use your admin account to access products, BOM structures, inventory, purchasing, and
          production views.
        </p>
      </section>

      <form
        className="panel login-panel"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const email = String(formData.get("email") ?? "").trim();
          const password = String(formData.get("password") ?? "");

          setError(null);

          startTransition(async () => {
            const supabase = await createRuntimeBrowserClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password
            });

            if (signInError) {
              setError(signInError.message);
              return;
            }

            router.replace(getPostLoginRedirectPath(searchParams.get("next")));
            router.refresh();
          });
        }}
      >
        <div className="panel-header">
          <div>
            <h3>Admin login</h3>
            <p className="small">Protected internal access for MiniMRP.</p>
          </div>
        </div>

        <div className="panel-body stack">
          <label className="field-group">
            <span>Email</span>
            <input className="input" name="email" type="email" autoComplete="email" required />
          </label>

          <label className="field-group">
            <span>Password</span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <div className="notice error">{error}</div> : null}

          <button className="button primary login-submit" type="submit" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
