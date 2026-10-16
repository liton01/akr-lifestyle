import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/feedback";
import { firstParam, safeRedirectPath } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(firstParam(params.next), "");
  const user = await getCurrentUser();
  if (user) redirect(next || "/account");

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to track orders, save addresses and check out faster."
      footer={
        <>
          New to AKR Lifestyle?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="link">
            Create an account
          </Link>
        </>
      }
    >
      {firstParam(params.reset) ? (
        <Alert tone="success" className="mb-5">
          Your password has been reset. Please sign in with your new password.
        </Alert>
      ) : null}
      <LoginForm next={next || undefined} />
    </AuthCard>
  );
}
