"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULES, passwordRuleStatus } from "@/lib/auth/password-recovery";

export function NewPasswordFields({
  idPrefix,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
}: {
  idPrefix: string;
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
}) {
  const rules = passwordRuleStatus(password);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordId = `${idPrefix}-new-password`;
  const confirmId = `${idPrefix}-confirm-password`;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={passwordId}>New password</Label>
        <Input
          id={passwordId}
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          aria-describedby={`${passwordId}-rules`}
        />
        <ul id={`${passwordId}-rules`} aria-live="polite" className="space-y-1 text-sm">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.id} className={rules[rule.id] ? "text-foreground" : "text-muted-foreground"}>
              {rules[rule.id] ? "Met" : "Needed"}: {rule.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor={confirmId}>Confirm password</Label>
        <Input
          id={confirmId}
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={confirmPassword}
          onChange={(event) => onConfirmChange(event.target.value)}
          aria-invalid={mismatch}
        />
        {mismatch ? (
          <p className="text-sm text-destructive" role="alert">
            Passwords do not match.
          </p>
        ) : null}
      </div>
    </>
  );
}
