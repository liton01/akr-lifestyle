"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeliveryZoneForm, type ZoneValues } from "./promo-forms";

export function ZoneEditor({ zone, districts }: { zone: ZoneValues; districts: readonly string[] }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
    );
  }
  return (
    <div className="mt-4 w-full rounded-lg border border-line p-4">
      <DeliveryZoneForm initial={zone} districts={districts} onDone={() => setEditing(false)} />
    </div>
  );
}

export function NewZonePanel({ districts }: { districts: readonly string[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>Add delivery zone</Button>;
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <DeliveryZoneForm
        initial={{ id: null, name: "", districts: [], fee: "", freeDeliveryThreshold: "", estimatedDays: "", isDefault: false, isActive: true, sortOrder: 0 }}
        districts={districts}
        onDone={() => setOpen(false)}
      />
    </div>
  );
}
