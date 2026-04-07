"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDemoAccessToken } from "@/lib/demo-security/auth";
import {
  DEMO_ACCESS_COOKIE,
  DEMO_ACCESS_ROUTE,
  getDemoPassword
} from "@/lib/demo-security/config";

export async function unlockDemoAction(formData: FormData) {
  const password = String(formData.get("password") ?? "").trim();

  if (password !== getDemoPassword()) {
    redirect(`${DEMO_ACCESS_ROUTE}?error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_ACCESS_COOKIE, createDemoAccessToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  redirect("/products");
}
