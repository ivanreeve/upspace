"use server";

import { z } from "zod";

const schema = z.object({
  email: z.string().email("Provide a valid email."),
  password: z.string().min(8, "Minimum 8 characters."),
});

export type LoginState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const data = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v ?? []])
    );
    return { ok: false, errors: fieldErrors, message: "Fix the highlighted fields." };
  }

  // Business logic gate is intentionally thin. NextAuth will perform the real check.
  return { ok: true };
}
