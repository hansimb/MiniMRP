"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const navigation = [
  { href: "/products", label: "Products" },
  { href: "/components", label: "Components" },
  { href: "/inventory", label: "Inventory" },
  { href: "/production", label: "Production" },
  { href: "/purchasing", label: "Purchasing" },
  { href: "/settings", label: "Settings" },
  { href: "/history", label: "History" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") {
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
          <button
            type="button"
            className="nav-action"
            onClick={() =>
              startTransition(async () => {
                const supabase = createSupabaseBrowserClient();
                await supabase.auth.signOut();
                router.replace("/login");
                router.refresh();
              })
            }
          >
            <span className="nav-icon" aria-hidden="true">{`->`}</span>
            <span>Log out</span>
          </button>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
