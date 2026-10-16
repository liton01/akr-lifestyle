"use client";

import { SubmitButton } from "@/components/ui/client";
import { Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { ROLE_LABELS } from "@/lib/permissions";
import { customerNoteAction, grantStaffRoleAction, setUserRoleAction } from "@/server/actions/admin/store";

export function CustomerNoteForm({ id, note }: { id: string; note: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(customerNoteAction);
  return (
    <form {...formProps} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="customer-note" className="sr-only">
        Internal note
      </label>
      <Textarea id="customer-note" name="note" rows={3} defaultValue={note} placeholder="Only visible to staff" />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} variant="outline" size="sm">
          Save note
        </SubmitButton>
        {state?.message ? <span className={state.ok ? "text-xs text-success" : "text-xs text-danger"}>{state.message}</span> : null}
      </div>
    </form>
  );
}

const ROLES = ["CUSTOMER", "ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"] as const;

export function RoleSelectForm({ id, role, disabled }: { id: string; role: (typeof ROLES)[number]; disabled?: boolean }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(setUserRoleAction);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`role-${id}`} className="sr-only">
        Role
      </label>
      <select id={`role-${id}`} name="role" defaultValue={role} disabled={disabled} className="h-8 rounded-md border border-line px-2 text-sm">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r === "CUSTOMER" ? "Remove staff access" : ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <SubmitButton pending={pending} size="sm" variant="outline" disabled={disabled}>
        Save
      </SubmitButton>
      {state?.message ? <span className={state.ok ? "w-full text-xs text-success" : "w-full text-xs text-danger"}>{state.message}</span> : null}
    </form>
  );
}

export function GrantStaffForm() {
  const { state, pending, formProps } = useActionForm<ActionResult>(grantStaffRoleAction);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3" noValidate>
      <div>
        <label htmlFor="staff-email" className="mb-1 block text-xs font-medium text-muted">
          Registered email
        </label>
        <input id="staff-email" name="email" type="email" className="h-9 w-64 rounded-md border border-line px-3 text-sm" required />
      </div>
      <div>
        <label htmlFor="staff-role" className="mb-1 block text-xs font-medium text-muted">
          Role
        </label>
        <select id="staff-role" name="role" defaultValue="STORE_MANAGER" className="h-9 rounded-md border border-line px-2 text-sm">
          <option value="STORE_MANAGER">{ROLE_LABELS.STORE_MANAGER}</option>
          <option value="INVENTORY_MANAGER">{ROLE_LABELS.INVENTORY_MANAGER}</option>
          <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
        </select>
      </div>
      <SubmitButton pending={pending}>Grant access</SubmitButton>
      {state?.message ? <p className={state.ok ? "w-full text-sm text-success" : "w-full text-sm text-danger"}>{state.message}</p> : null}
    </form>
  );
}
