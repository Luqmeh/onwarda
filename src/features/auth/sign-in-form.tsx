"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = {};

type SignInFormProps = {
  nextPath: string;
  title: string;
  description: string;
  recoveryHref: string;
};

export function SignInForm({ nextPath, title, description, recoveryHref }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>

      <p className="text-right text-sm">
        <Link href={recoveryHref} className="font-medium underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </p>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to Onwarda?{" "}
        <Link href="/signup" className="font-medium underline-offset-4 hover:underline">
          Start with Onwarda
        </Link>
      </p>
    </form>
  );
}
