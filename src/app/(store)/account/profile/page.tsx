import type { Metadata } from "next";
import { ChangePasswordForm, ProfileForm } from "@/components/account/account-forms";
import { requireUserPage } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Profile & security", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUserPage("/account/profile");
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
  return (
    <div className="space-y-8">
      <section className="card p-6" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-2xl font-semibold">
          Profile
        </h2>
        <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>
        <div className="mt-6">
          <ProfileForm
            defaults={{ name: user.name, phone: profile?.phone ?? "", gender: profile?.gender ?? "", marketingOptIn: profile?.marketingOptIn ?? false }}
          />
        </div>
      </section>
      <section className="card p-6" aria-labelledby="password-heading">
        <h2 id="password-heading" className="text-2xl font-semibold">
          Change password
        </h2>
        <p className="mt-1 text-sm text-muted">Changing your password signs you out on other devices.</p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
