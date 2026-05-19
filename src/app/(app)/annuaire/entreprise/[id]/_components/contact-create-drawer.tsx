"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { createCompanyContact } from "@/server/actions/annuaire/company-contacts";

const Schema = z.object({
  name: z.string().min(1, "Nom obligatoire."),
  role: z.enum(["gerant", "conducteur", "comptabilite", "autre"]),
  email: z
    .string()
    .email("Email invalide.")
    .or(z.literal(""))
    .optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function ContactCreateDrawer({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", role: "gerant" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createCompanyContact({
      companyId,
      name: values.name,
      role: values.role,
      email: values.email || null,
      phone: values.phone || null,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Contact "${values.name}" ajouté.`);
    form.reset();
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={520}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Annuaire
            </div>
            <h2 className="title-xl mt-2">Ajouter un contact</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: "var(--surface)" }}
          >
            <CloseIcon />
          </button>
        </div>
      </DrawerHeader>

      <DrawerBody>
        <form onSubmit={onSubmit} id="contact-create-form" className="space-y-4">
          <Field
            label="Nom complet *"
            error={form.formState.errors.name?.message}
          >
            <input
              {...form.register("name")}
              type="text"
              autoFocus
              placeholder="Jean Dupont"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field label="Rôle *">
            <select
              {...form.register("role")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="gerant">Gérant</option>
              <option value="conducteur">Conducteur de travaux</option>
              <option value="comptabilite">Comptabilité</option>
              <option value="autre">Autre</option>
            </select>
          </Field>

          <Field
            label="Email"
            error={form.formState.errors.email?.message}
          >
            <input
              {...form.register("email")}
              type="email"
              placeholder="jean.dupont@example.com"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field label="Téléphone">
            <input
              {...form.register("phone")}
              type="tel"
              placeholder="06 12 34 56 78"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="contact-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Ajout…" : "Ajouter le contact"}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="text-[12px] font-semibold mb-1.5 block"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
      {error && (
        <span
          className="text-[11px] mt-1 block"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </span>
      )}
    </label>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
