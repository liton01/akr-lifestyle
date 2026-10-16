import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-10 w-10" />}
      title="You don't have access to this page"
      description="Your role does not include this permission. Ask an administrator if you need access."
      action={<ButtonLink href="/admin">Back to dashboard</ButtonLink>}
    />
  );
}
