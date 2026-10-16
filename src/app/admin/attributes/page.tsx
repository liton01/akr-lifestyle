import { ActionButton } from "@/components/admin/action-button";
import { AttributeForm, AttributeValueForm } from "@/components/admin/taxonomy-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { deleteAttributeAction, deleteAttributeValueAction } from "@/server/actions/admin/catalog";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata = { title: "Attributes" };

export default async function AttributesPage() {
  const user = await requireStaffPage("product:read", "/admin/attributes");
  const canWrite = can(user.role, "catalog:write");
  const attributes = await prisma.attribute.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }], include: { _count: { select: { variantOptions: true } } } },
      _count: { select: { variantOptions: true } },
    },
  });
  return (
    <>
      <AdminPageHeader title="Attributes" description="Options used to build product variants, such as Color, Size or Material." />
      {canWrite ? (
        <Panel title="New attribute" className="mb-6">
          <AttributeForm />
        </Panel>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {attributes.map((attribute) => (
          <Panel
            key={attribute.id}
            title={attribute.name}
            description={`${attribute.displayType === "COLOR" ? "Colour swatches" : "Text"} · used by ${attribute._count.variantOptions} variant(s)`}
            actions={
              canWrite && attribute._count.variantOptions === 0 ? (
                <ActionButton action={deleteAttributeAction} fields={{ id: attribute.id }} variant="ghost" confirm={{ title: `Delete ${attribute.name}?`, confirmLabel: "Delete" }}>
                  Delete
                </ActionButton>
              ) : null
            }
          >
            {canWrite ? (
              <div className="mb-4 border-b border-line pb-4">
                <AttributeForm initial={{ id: attribute.id, name: attribute.name, displayType: attribute.displayType, sortOrder: attribute.sortOrder }} />
              </div>
            ) : null}
            <ul className="flex flex-wrap gap-2">
              {attribute.values.map((value) => (
                <li key={value.id} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-3 pr-1 text-sm">
                  {value.colorHex ? <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: value.colorHex }} aria-hidden="true" /> : null}
                  {value.value}
                  <span className="text-xs text-muted">({value._count.variantOptions})</span>
                  {canWrite && value._count.variantOptions === 0 ? (
                    <ActionButton action={deleteAttributeValueAction} fields={{ id: value.id }} variant="ghost" size="sm">
                      ×<span className="sr-only">Delete {value.value}</span>
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <div className="mt-4">
                <AttributeValueForm attributeId={attribute.id} color={attribute.displayType === "COLOR"} />
              </div>
            ) : null}
          </Panel>
        ))}
      </div>
    </>
  );
}
