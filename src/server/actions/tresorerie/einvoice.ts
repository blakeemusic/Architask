"use server";

import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import {
  honoraireContracts,
  honoraireSituations,
} from "@/db/schema/honoraires";
import { operations } from "@/db/schema/operations";
import {
  einvoiceConfigurations,
  einvoiceEvents,
} from "@/db/schema/tresorerie";
import { getEInvoiceProvider } from "@/lib/einvoice";
import { canAccessCockpit } from "@/lib/cockpit-access";
import { getFileForRead } from "@/lib/storage/local";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const SendNhSchema = z.object({
  honoraireSituationId: z.string().uuid(),
});

const ListEventsSchema = z.object({
  direction: z.enum(["out", "in"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function sendNHAsFacturX(
  rawInput: z.input<typeof SendNhSchema>,
): Promise<
  ActionResult<{
    eventId: string;
    externalId: string;
    status: "envoyee" | "transmise" | "acceptee" | "refusee" | "payee";
  }>
> {
  return withAction(SendNhSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const sit = await db.query.honoraireSituations.findFirst({
      where: eq(honoraireSituations.id, input.honoraireSituationId),
      with: {
        contract: {
          with: {
            operation: { columns: { organizationId: true, name: true } },
            moa: { columns: { raisonSociale: true } },
          },
        },
        signedPdf: true,
      },
    });
    if (
      !sit ||
      sit.contract.operation.organizationId !== user.organizationId
    ) {
      return err("Note d'honoraires introuvable.", "not_found");
    }
    if (sit.statut === "brouillon") {
      return err(
        "Signer la note avant de l'envoyer via Factur-X.",
        "not_signed",
      );
    }

    let pdfBuffer = Buffer.alloc(0);
    if (sit.signedPdfFileId) {
      const f = await getFileForRead(sit.signedPdfFileId);
      if (f?.stream) {
        const chunks: Buffer[] = [];
        for await (const chunk of f.stream) {
          chunks.push(chunk as Buffer);
        }
        pdfBuffer = Buffer.concat(chunks);
      }
    }

    const provider = getEInvoiceProvider(user.organizationId);
    const result = await provider.sendInvoice({
      organizationId: user.organizationId,
      honoraireSituationId: sit.id,
      pdfBuffer,
      payload: {
        numero: sit.numero,
        montantHt: sit.montantHt ?? "0",
        montantTva: sit.montantTva ?? "0",
        montantTtc: sit.montantTtc ?? "0",
        moaName: sit.contract.moa?.raisonSociale ?? "—",
        dateEmission: sit.dateEmission,
        delaiPaiementJours: sit.contract.delaiPaiementJours,
      },
    });

    const [event] = await db
      .insert(einvoiceEvents)
      .values({
        honoraireSituationId: sit.id,
        direction: "out",
        status: result.status,
        rawPayload: {
          externalId: result.externalId,
          provider: provider.name,
          numero: sit.numero,
        },
      })
      .returning();

    // Met aussi à jour le statut de la situation si pertinent
    if (sit.statut === "signee") {
      await db
        .update(honoraireSituations)
        .set({ statut: "envoyee", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(honoraireSituations.id, sit.id));
    }

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "einvoice_event",
      entityId: event.id,
      action: "facturx_sent",
      payloadDiff: {
        numero: sit.numero,
        provider: provider.name,
        status: result.status,
      },
    });

    revalidatePath(
      `/operations/${sit.contract.operation.organizationId}/honoraires`,
    );
    revalidatePath("/cockpit/facturation");
    revalidatePath("/cockpit/tresorerie");
    return ok({
      eventId: event.id,
      externalId: result.externalId,
      status: result.status,
    });
  });
}

export async function listEInvoiceEvents(
  rawInput: z.input<typeof ListEventsSchema>,
): Promise<
  ActionResult<
    Array<{
      id: string;
      direction: "out" | "in";
      status: "envoyee" | "transmise" | "acceptee" | "refusee" | "payee";
      occurredAt: Date;
      honoraireSituation: {
        id: string;
        numero: string;
        montantTtc: string | null;
        operationName: string;
      } | null;
      expenseInvoice: {
        id: string;
        supplierName: string;
        montantTtc: string | null;
      } | null;
    }>
  >
> {
  return withAction(ListEventsSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    // Garde les events liés à des situations / factures de notre org
    const sitsOurOrg = await db
      .select({ id: honoraireSituations.id })
      .from(honoraireSituations)
      .innerJoin(
        honoraireContracts,
        eq(honoraireContracts.id, honoraireSituations.contractId),
      )
      .innerJoin(
        operations,
        eq(operations.id, honoraireContracts.operationId),
      )
      .where(eq(operations.organizationId, user.organizationId));
    const sitIds = sitsOurOrg.map((s) => s.id);

    const events = await db.query.einvoiceEvents.findMany({
      where: input.direction
        ? eq(einvoiceEvents.direction, input.direction)
        : undefined,
      orderBy: [desc(einvoiceEvents.occurredAt)],
      limit: input.limit ?? 50,
      with: {
        situation: {
          with: {
            contract: {
              with: {
                operation: {
                  columns: { name: true, organizationId: true },
                },
              },
            },
          },
        },
        expense: true,
      },
    });

    return ok(
      events
        .filter((e) => {
          if (e.honoraireSituationId) {
            return sitIds.includes(e.honoraireSituationId);
          }
          if (e.expense) {
            return e.expense.organizationId === user.organizationId;
          }
          return false;
        })
        .map((e) => ({
          id: e.id,
          direction: e.direction as "out" | "in",
          status: e.status as
            | "envoyee"
            | "transmise"
            | "acceptee"
            | "refusee"
            | "payee",
          occurredAt: e.occurredAt,
          honoraireSituation: e.situation
            ? {
                id: e.situation.id,
                numero: e.situation.numero,
                montantTtc: e.situation.montantTtc,
                operationName:
                  e.situation.contract.operation.name ?? "—",
              }
            : null,
          expenseInvoice: e.expense
            ? {
                id: e.expense.id,
                supplierName: e.expense.supplierName,
                montantTtc: e.expense.montantTtc,
              }
            : null,
        })),
    );
  });
}

export async function getEInvoiceConfig(): Promise<
  ActionResult<typeof einvoiceConfigurations.$inferSelect | null>
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const cfg = await db.query.einvoiceConfigurations.findFirst({
      where: eq(einvoiceConfigurations.organizationId, user.organizationId),
    });
    return ok(cfg ?? null);
  });
}

void and;
void gte;
void inArray;
void isNull;
