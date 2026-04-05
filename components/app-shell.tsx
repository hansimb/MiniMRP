"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/products", label: "Products" },
  { href: "/components", label: "Components" },
  { href: "/inventory", label: "Inventory" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

