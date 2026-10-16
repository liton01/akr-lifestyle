import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/feedback";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const error = firstParam(params.error);
  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      {!token || error ? (
        <div className="space-y-4">
          <Alert tone="danger" title="This reset link is invalid or has expired.">
            Reset links are valid for one hour and can be used once.
          </Alert>
          <Link href="/forgot-password" className="link text-sm">
            Request a new link
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthCard>
  );
}
