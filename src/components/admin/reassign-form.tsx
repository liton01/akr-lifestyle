"use client";

import { FormMessage, SubmitButton } from "@/components/ui/client";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";

export function ReassignForm({
  action,
  id,
  targets,
  label,
  allowNone,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  id: string;
  targets: { id: string; name: string }[];
  label: string;
  allowNone?: boolean;
}) {
  const { state, pending, formProps } = useActionForm<ActionResult>(action);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <label htmlFor={`reassign-${id}`} className="block text-sm font-medium">
        {label}
      </label>
      <select id={`reassign-${id}`} name="targetId" className="h-10 w-full rounded-md border border-line px-3 text-sm" defaultValue="">
        <option value="">{allowNone ? "No brand" : "Choose…"}</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <SubmitButton pending={pending} variant="outline" size="sm">
        Move products
      </SubmitButton>
    </form>
  );
}
