"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/database/server";
import { safeInternalPath } from "@/lib/auth/safe-path";
import { emailSchema } from "@/lib/validation/common";
import { z } from "zod";

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  next: z.string().optional(),
});

export type AuthActionState = {
  error?: string;
};

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Invalid email or password." };
  }

  const destination = safeInternalPath(parsed.data.next, "/app");

  if (destination === "/admin" || destination.startsWith("/admin/")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      await supabase.auth.signOut();
      return { error: "Invalid email or password." };
    }

    const { data: admin, error: adminError } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      return { error: "Platform administrator access is required." };
    }
  }

  redirect(destination);
}

export async function signOutAction(redirectTo = "/login") {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(safeInternalPath(redirectTo, "/login"));
}
