import { describe, expect, it } from "vitest";

import {
  computeDGD,
  suggestPenalitesPourRetard,
  type ComputeDgdInput,
} from "@/lib/finance/computeDGD";

const baseLot = {
  montantMarcheHt: "100000.00",
  tauxTva: "20.00",
  avenantsSignes: [],
};

function makeInput(overrides: Partial<ComputeDgdInput> = {}): ComputeDgdInput {
  return {
    lot: baseLot,
    cps: [],
    ...overrides,
  };
}

describe("computeDGD — cas standards", () => {
  it("Solde positif : 5% retenue garantie sur lot à 100% versé brut", () => {
    // Marché 100k, 100% versé hors retenue (= 95k brut versé), DGD doit
    // = 100k - 95k = 5 000 dû à l'entreprise (retenue à libérer).
    const r = computeDGD(
      makeInput({
        cps: [
          { brutAPayerHt: "95000", statut: "paye" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.marcheReviseHt).toBe("100000.00");
    expect(r.data.cumulCpVersesHt).toBe("95000.00");
    expect(r.data.soldeHt).toBe("5000.00");
    expect(r.data.soldeTtc).toBe("6000.00");
    expect(r.data.isDuEntreprise).toBe(true);
    expect(r.data.isDuMoa).toBe(false);
  });

  it("Solde négatif : trop versé à l'entreprise", () => {
    const r = computeDGD(
      makeInput({
        cps: [{ brutAPayerHt: "110000", statut: "paye" }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.soldeHt).toBe("-10000.00");
    expect(r.data.isDuMoa).toBe(true);
    expect(r.data.warnings.some((w) => w.includes("Solde négatif"))).toBe(true);
  });

  it("Aucun CP versé : warning + solde = marché révisé", () => {
    const r = computeDGD(makeInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.soldeHt).toBe("100000.00");
    expect(r.data.warnings.some((w) => w.includes("Aucun CP"))).toBe(true);
  });
});

describe("computeDGD — avenants signés", () => {
  it("Avenant signé augmente le marché révisé et donc le solde", () => {
    const r = computeDGD(
      makeInput({
        lot: { ...baseLot, avenantsSignes: [{ montantHt: "20000" }] },
        cps: [{ brutAPayerHt: "95000", statut: "paye" }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.marcheReviseHt).toBe("120000.00");
    expect(r.data.soldeHt).toBe("25000.00");
  });

  it("Avenant en moins (négatif) diminue le marché révisé", () => {
    const r = computeDGD(
      makeInput({
        lot: { ...baseLot, avenantsSignes: [{ montantHt: "-15000" }] },
        cps: [{ brutAPayerHt: "80000", statut: "paye" }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.marcheReviseHt).toBe("85000.00");
    expect(r.data.soldeHt).toBe("5000.00");
  });
});

describe("computeDGD — travaux suppl. + pénalités", () => {
  it("Travaux suppl. acceptés ajoutent au solde", () => {
    const r = computeDGD(
      makeInput({
        cps: [{ brutAPayerHt: "95000", statut: "paye" }],
        travauxSupplAcceptesHt: "3500",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.soldeHt).toBe("8500.00");
  });

  it("Pénalités diminuent le solde", () => {
    const r = computeDGD(
      makeInput({
        cps: [{ brutAPayerHt: "95000", statut: "paye" }],
        penalitesHt: "2000",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.soldeHt).toBe("3000.00");
  });

  it("Warning si pénalités > 15% du marché initial", () => {
    const r = computeDGD(
      makeInput({
        cps: [{ brutAPayerHt: "80000", statut: "paye" }],
        penalitesHt: "20000",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.warnings.some((w) => w.includes("Pénalités élevées"))).toBe(
      true,
    );
  });
});

describe("computeDGD — TVA", () => {
  it("TVA 10% sur solde 5000 HT", () => {
    const r = computeDGD(
      makeInput({
        lot: { ...baseLot, tauxTva: "10.00" },
        cps: [{ brutAPayerHt: "95000", statut: "paye" }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.soldeHt).toBe("5000.00");
    expect(r.data.soldeTtc).toBe("5500.00");
  });
});

describe("computeDGD — CP brouillon ignoré", () => {
  it("CP brouillon n'est pas inclus dans le cumul versé", () => {
    const r = computeDGD(
      makeInput({
        cps: [
          { brutAPayerHt: "90000", statut: "paye" },
          { brutAPayerHt: "5000", statut: "brouillon" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cumulCpVersesHt).toBe("90000.00");
    expect(r.data.soldeHt).toBe("10000.00");
  });
});

describe("computeDGD — erreurs", () => {
  it("Marché négatif rejette", () => {
    const r = computeDGD(
      makeInput({ lot: { ...baseLot, montantMarcheHt: "-100" } }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.data.code).toBe("invalid_amount");
  });

  it("Pénalités négatives rejette", () => {
    const r = computeDGD(makeInput({ penalitesHt: "-500" }));
    expect(r.ok).toBe(false);
  });
});

describe("suggestPenalitesPourRetard", () => {
  it("Calcule 1/1000/jour sur marché révisé", () => {
    const r = suggestPenalitesPourRetard({
      marcheReviseHt: "100000",
      dateReceptionPrevue: new Date("2026-01-01"),
      dateReceptionReelle: new Date("2026-01-31"), // 30 jours
    });
    // 100 000 × 0.001 × 30 = 3 000 €
    expect(r.suggested).toBe("3000.00");
    expect(r.daysRetard).toBe(30);
  });

  it("0 jours de retard → 0 €", () => {
    const r = suggestPenalitesPourRetard({
      marcheReviseHt: "100000",
      dateReceptionPrevue: new Date("2026-01-31"),
      dateReceptionReelle: new Date("2026-01-01"), // avance
    });
    expect(r.suggested).toBe("0.00");
    expect(r.daysRetard).toBe(0);
  });

  it("Sans date prévue → suggestion 0", () => {
    const r = suggestPenalitesPourRetard({
      marcheReviseHt: "100000",
      dateReceptionPrevue: null,
      dateReceptionReelle: new Date(),
    });
    expect(r.suggested).toBe("0.00");
  });
});
