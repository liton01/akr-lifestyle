import type { ContactMessageStatus } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/lib/permissions";
import { emailSchema, optionalTextSchema } from "@/lib/validation/common";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: emailSchema,
  phone: optionalTextSchema(20),
  subject: z.string().trim().min(3, "Enter a subject.").max(150),
  message: z.string().trim().min(10, "Please write at least 10 characters.").max(5000),
  // Honeypot field — must stay empty (bots fill every field).
  website: z.string().max(0, "Invalid submission.").optional().default(""),
});

export async function createContactMessage(db: Db, raw: unknown) {
  const input = contactSchema.parse(raw);
  return db.contactMessage.create({
    data: { name: input.name, email: input.email, phone: input.phone, subject: input.subject, message: input.message },
  });
}

export async function listContactMessages(db: Db, options: { status?: ContactMessageStatus; page: number; pageSize: number }) {
  const where = options.status ? { status: options.status } : { status: { not: "ARCHIVED" as const } };
  const [rows, total] = await Promise.all([
    db.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (options.page - 1) * options.pageSize, take: options.pageSize }),
    db.contactMessage.count({ where }),
  ]);
  return { rows, total };
}

export async function setContactMessageStatus(db: Db, actor: Actor, id: string, status: ContactMessageStatus) {
  assertPermission(actor, "messages:read");
  await db.contactMessage.update({ where: { id }, data: { status } });
  await writeAudit(db, actor, { action: "contact.status", entityType: "ContactMessage", entityId: id, metadata: { status } });
}
