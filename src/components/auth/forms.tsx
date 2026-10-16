"use client";

import Link from "next/link";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { useActionForm } from "@/components/ui/use-action-form";
import { Checkbox, Field, Input } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import {
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
  signInAction,
} from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(signInAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Email" name="email" required errors={errors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required />}
      </Field>
      <Field label="Password" name="password" required errors={errors?.password}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" required />}
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-charcoal underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(registerAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok && state.message) return <FormMessage state={state} />;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Full name" name="name" required errors={errors?.name}>
        {(p) => <Input {...p} autoComplete="name" required />}
      </Field>
      <Field label="Email" name="email" required errors={errors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required />}
      </Field>
      <Field label="Mobile number" name="phone" hint="Optional — used for delivery updates." errors={errors?.phone}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Password" name="password" required hint="At least 8 characters." errors={errors?.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={8} />}
        </Field>
        <Field label="Confirm password" name="confirmPassword" required errors={errors?.confirmPassword}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
        </Field>
      </div>
      <div>
        <Checkbox
          name="acceptTerms"
          label={
            <>
              I agree to the{" "}
              <Link href="/terms" className="link" target="_blank">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="link" target="_blank">
                privacy policy
              </Link>
              .
            </>
          }
        />
        {errors?.acceptTerms ? <p className="mt-1.5 text-sm text-danger">{errors.acceptTerms[0]}</p> : null}
      </div>
      <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, pending, formProps } = useActionForm<ActionResult>(requestPasswordResetAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field label="Email" name="email" required errors={errors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required />}
      </Field>
      <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(resetPasswordAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="New password" name="password" required hint="At least 8 characters." errors={errors?.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field label="Confirm new password" name="confirmPassword" required errors={errors?.confirmPassword}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton pending={pending} className="w-full" size="lg" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
