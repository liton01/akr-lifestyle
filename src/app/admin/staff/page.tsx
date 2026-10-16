import { GrantStaffForm, RoleSelectForm } from "@/components/admin/simple-forms";
import { AdminPageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/feedback";
import { PERMISSIONS, ROLE_LABELS, STAFF_ROLES } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { listStaff } from "@/server/services/customers";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const user = await requireStaffPage("staff:manage", "/admin/staff");
  const staff = await listStaff(prisma);
  return (
    <>
      <AdminPageHeader title="Staff & roles" description="Roles control what each person can do. Every privileged action is checked on the server." />
      <Panel title="Give someone staff access" description="The person must first create a customer account with their email." className="mb-6">
        <GrantStaffForm />
      </Panel>
      <Table className="mb-8">
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Last sign-in</Th>
            <Th>Change role</Th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <Td>
                <span className="font-medium">{s.name}</span>
                <span className="block text-xs text-muted">{s.email}</span>
              </Td>
              <Td>{ROLE_LABELS[s.role]}</Td>
              <Td>{s.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}</Td>
              <Td className="text-xs text-muted">{s.lastLoginAt ? s.lastLoginAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "—"}</Td>
              <Td>{s.id === user.id ? <span className="text-xs text-muted">You</span> : <RoleSelectForm id={s.id} role={s.role} />}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Panel title="Permission matrix">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2">Permission</th>
                {STAFF_ROLES.map((r) => (
                  <th key={r} className="py-2 text-center">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([permission, roles]) => (
                <tr key={permission} className="border-t border-line">
                  <td className="py-1.5 font-mono text-xs">{permission}</td>
                  {STAFF_ROLES.map((r) => (
                    <td key={r} className="py-1.5 text-center">
                      {(roles as readonly string[]).includes(r) ? "✓" : <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
