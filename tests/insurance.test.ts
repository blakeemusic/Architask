import { describe, expect, it } from "vitest";

import {
  assertInsuranceValidAtOS,
  computeInsuranceStatus,
  type InsuranceForValidation,
} from "@/lib/validation/insurance";

const decennaleValide: InsuranceForValidation = {
  type: "decennale",
  dateDebut: new Date("2025-01-01"),
  dateFin: new Date("2027-12-31"),
  activitesCouvertes: ["gros_oeuvre", "fondations", "macconnerie"],
};

const decennaleExpiree: InsuranceForValidation = {
  type: "decennale",
  dateDebut: new Date("2022-01-01"),
  dateFin: new Date("2024-12-31"),
  activitesCouvertes: ["gros_oeuvre"],
};

const rcPro: InsuranceForValidation = {
  type: "rc_pro",
  dateDebut: new Date("2024-01-01"),
  dateFin: new Date("2030-12-31"),
  activitesCouvertes: [],
};

describe("assertInsuranceValidAtOS", () => {
  it("valide : décennale couvre la date OS et toutes les activités", () => {
    const result = assertInsuranceValidAtOS(
      [decennaleValide],
      new Date("2026-05-15"),
      ["gros_oeuvre", "fondations"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matchingInsurance.type).toBe("decennale");
      expect(result.data.warnings).toHaveLength(0);
    }
  });

  it("rejette : aucune décennale dans la liste (que des RC pro)", () => {
    const result = assertInsuranceValidAtOS(
      [rcPro],
      new Date("2026-05-15"),
      ["gros_oeuvre"],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("no_decennale");
  });

  it("rejette : décennale expirée à la date OS", () => {
    const result = assertInsuranceValidAtOS(
      [decennaleExpiree],
      new Date("2026-05-15"), // après dateFin
      ["gros_oeuvre"],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("decennale_expired");
  });

  it("rejette : décennale valide mais activité non couverte", () => {
    const result = assertInsuranceValidAtOS(
      [decennaleValide],
      new Date("2026-05-15"),
      ["plomberie"], // pas dans activitesCouvertes
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("decennale_activity_not_covered");
      expect(result.error).toContain("plomberie");
    }
  });

  it("warning non-bloquant : décennale expire avant fin du chantier", () => {
    const result = assertInsuranceValidAtOS(
      [decennaleValide], // expire le 2027-12-31
      new Date("2026-05-15"),
      ["gros_oeuvre"],
      new Date("2028-06-30"), // fin chantier après expiration
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.warnings).toHaveLength(1);
      expect(result.data.warnings[0]).toContain("expire");
    }
  });

  it("case-insensitive sur les activités", () => {
    const result = assertInsuranceValidAtOS(
      [decennaleValide], // GROS_OEUVRE en bas-de-casse
      new Date("2026-05-15"),
      ["Gros_Oeuvre", "FONDATIONS"],
    );
    expect(result.ok).toBe(true);
  });
});

describe("computeInsuranceStatus", () => {
  const now = new Date("2026-05-15");

  it("valide si date_fin > now + 60 jours", () => {
    expect(
      computeInsuranceStatus({ dateFin: new Date("2027-12-31") }, now),
    ).toBe("valide");
  });

  it("expirant_60j si entre 0 et 60 jours", () => {
    expect(
      computeInsuranceStatus({ dateFin: new Date("2026-06-15") }, now),
    ).toBe("expirant_60j");
  });

  it("expire si date_fin <= now", () => {
    expect(
      computeInsuranceStatus({ dateFin: new Date("2026-05-14") }, now),
    ).toBe("expire");
  });
});
