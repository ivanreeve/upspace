"use client";

import { useEffect, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "next-auth/react";
import Link from "next/link";
import type { LoginState } from "@/app/(auth)/signin/actions";
import { loginAction } from "@/app/(auth)/signin/actions";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: LoginState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className={[
        "w-full h-10 inline-flex items-center justify-center rounded-lg px-4 py-2",
        "bg-primary text-primary-foreground border border-border",
        "transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70",
      ].join(" ")}
    >
      {pending ? "Validating…" : "Sign In"}
    </Button>
  );
}

export default function EmailPasswordForm({
  callbackUrl = "/dashboard",
  forgotHref = "/forgot-password",
}: { callbackUrl?: string; forgotHref?: string }) {
  // Local mirrors to invoke NextAuth after server validation passes.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [state, formAction] =
    useActionState<LoginState, FormData>(loginAction, initialState);

  useEffect(() => {
    if (state.ok) {
      // Hand off to NextAuth Credentials provider.
      // No secrets baked; provider config lives server-side.
      void signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: true,
      });
    }
  }, [state.ok, email, password, callbackUrl]);

  const fieldErr = (k: string) => state.errors?.[k]?.[0];

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="font-sf text-sm text-muted-foreground">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={[
            "w-full h-10 rounded-md px-3",
            "bg-border text-foreground border border-input",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ].join(" ")}
          placeholder="Enter your email"
        />
        {fieldErr("email") && <p className="text-sm text-destructive">{fieldErr("email")}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
          <Link href={forgotHref} className="text-sm text-primary hover:underline">Forgot password?</Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={[
            "w-full h-10 rounded-md px-3",
            "bg-border text-foreground border border-input",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ].join(" ")}
          placeholder="Password"
        />
        {fieldErr("password") && <p className="text-sm text-destructive">{fieldErr("password")}</p>}
      </div>

      {state.message && !state.ok && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}

      <SubmitButton />
    </form>
  );
}
