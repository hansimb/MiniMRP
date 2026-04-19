import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getFixLoopBrowserEnv, hasFixLoopBrowserEnv } from "@/lib/fixloop/env";
import { AppShell } from "@/shared/ui";

export const metadata: Metadata = {
  title: "MiniMRP",
  description: "Internal MRP tool for Spectrum Audio Instruments"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fixLoopEnv = getFixLoopBrowserEnv();
  const fixLoopProjectName = hasFixLoopBrowserEnv()
    ? fixLoopEnv.projectName
    : undefined;

  return (
    <html lang="en">
      <body>
        <AppShell fixLoopProjectName={fixLoopProjectName}>{children}</AppShell>
      </body>
    </html>
  );
}
