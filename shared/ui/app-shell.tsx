"use client";

import { AgenticFixLoop } from "@hansimb/fix-loop-widget";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, type ReactNode } from "react";
import { createRuntimeBrowserClient } from "@/lib/runtime/browser-client";
import { getPostLogoutRedirectPath } from "@/lib/auth/redirects";
import { getRuntimeMode } from "@/lib/runtime/env";

const navigation = [
  { href: "/products", label: "Products" },
  { href: "/components", label: "Components" },
  { href: "/inventory", label: "Inventory" },
  { href: "/production", label: "Production" },
  { href: "/purchasing", label: "Purchasing" },
  { href: "/settings", label: "Settings" },
  { href: "/history", label: "History" },
];

export function AppShell({
  children,
  fixLoopProjectName,
}: {
  children: ReactNode;
  fixLoopProjectName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const runtimeMode = getRuntimeMode();

  if (pathname === "/login" || pathname === "/forbidden") {
    return <main className="content">{children}</main>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1>MiniMRP</h1>
        <p>Internal component, BOM and inventory management for SAI.</p>
        <nav className="nav">
          {navigation.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className={pathname.startsWith(item.href) ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
          {runtimeMode === "supabase" ? (
            <button
              type="button"
              className="nav-action"
              onClick={() =>
                startTransition(async () => {
                  const supabase = await createRuntimeBrowserClient();
                  await supabase.auth.signOut();
                  router.replace(getPostLogoutRedirectPath());
                  router.refresh();
                })
              }
            >
              <span className="nav-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M21 21V3" />
                </svg>
              </span>
              <span>Log out</span>
            </button>
          ) : null}
        </nav>
      </aside>
      <main className="content">
        {children}
        {fixLoopProjectName ? (
          <AgenticFixLoop
            projectName={fixLoopProjectName}
            position="bottom-left"
          />
        ) : null}
      </main>
    </div>
  );
}
