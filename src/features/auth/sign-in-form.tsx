"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";
import { signInAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = {};

type SignInFormProps = {
  nextPath: string;
  title: string;
  description: string;
  recoveryHref: string;
};

export function SignInForm({ nextPath, title, description, recoveryHref }: SignInFormProps) {
  const { messages } = useI18n();
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const error =
    state.error === "Invalid email or password."
      ? messages.auth.invalidCredentials
      : state.error === "Enter a valid email and password."
        ? messages.auth.enterCredentials
        : state.error === "Platform administrator access is required."
          ? messages.auth.adminRequired
          : state.error
            ? messages.states.error
            : null;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-2">
        <Label htmlFor="email">{messages.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{messages.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>

      <p className="text-end text-sm">
        <Link href={recoveryHref} className="font-medium underline-offset-4 hover:underline">
          {messages.auth.forgotPassword}
        </Link>
      </p>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? messages.auth.signingIn : messages.auth.signIn}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {messages.auth.newToOnwarda}{" "}
        <Link href="/signup" className="font-medium underline-offset-4 hover:underline">
          {messages.auth.startWithOnwarda}
        </Link>
      </p>
    </form>
  );
}
