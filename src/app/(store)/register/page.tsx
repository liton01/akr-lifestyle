import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/forms";
import { firstParam, safeRedirectPath } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const next = safeRedirectPath(firstParam(params.next), "");
  if (await getCurrentUser()) redirect(next || "/account");
  return (
    <AuthCard
      title="Create your account"
      subtitle="Faster checkout, saved addresses and order tracking in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="link">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next || undefined} />
    </AuthCard>
  );
}
