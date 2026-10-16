import type { ReactNode } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { requireUserPage } from "@/server/auth/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUserPage("/account");
  return (
    <div className="container-page py-8 lg:py-12">
      <p className="eyebrow">My account</p>
      <h1 className="mt-2 text-4xl font-semibold">Hello, {user.name.split(" ")[0]}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
