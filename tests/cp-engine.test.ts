import { describe, expect, it } from "vitest";

import {
  computeCP,
  type ComputeCpInput,
} from "@/lib/finance/computeCP";

const baseLot = {
  montantMarcheHt: "100000.00",
  retenueGarantiePct: "5.00",
  tauxTva: "20.00",
  avenantsSignes: [],
};

function makeInput(overrides: Partial<ComputeCpInput> = {}): ComputeCpInput {
  return {
    lot: baseLot,
    previousCPs: [],
    situation: { mode: "global", pctGlobal: "50" },
    ...overrides,
  };
}

describe("computeCP — premier CP", () => {
  it("CP n°1 sans précédents, avancement 50%", () => {
    const r = computeCP(makeInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.marcheReviseHt).toBe("100000.00");
    expect(r.data.cumulTravauxHt).toBe("50000.00");
    expect(r.data.cumulCpPrecedentsHt).toBe("0.00");
    expect(r.data.brutAPayerHt).toBe("50000.00");
    expect(r.data.retenueGarantie).toBe("2500.00");
    expect(r.data.revisionMontantHt).toBe("0.00");
    expect(r.data.montantHt).toBe("47500.00");
    expect(r.data.tva).toBe("9500.00");
    expect(r.data.netTtc).toBe("57000.00");
  });

  it("CP n°1 mode lines (somme postes)", () => {
    const r = computeCP(
      makeInput({
        situation: {
          mode: "lines",
          lines: [
            { montantCumuleHt: "20000" },
            { montantCumuleHt: "15000" },
            { montantCumuleHt: "5000.50" },
          ],
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cumulTravauxHt).toBe("40000.50");
    expect(r.data.brutAPayerHt).toBe("40000.50");
  });
});

describe("computeCP — CP suivants", () => {
  it("CP n°2 avec un précédent payé", () => {
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "75" },
        previousCPs: [
          {
            brutAPayerHt: "50000.00",
            retenueGarantie: "2500.00",
            statut: "paye",
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cumulTravauxHt).toBe("75000.00");
    expect(r.data.cumulCpPrecedentsHt).toBe("50000.00");
    expect(r.data.brutAPayerHt).toBe("25000.00");
    expect(r.data.retenueGarantie).toBe("1250.00");
    expect(r.data.cumulRetenues).toBe("3750.00");
  });

  it("CP brouillon ignoré dans le cumul précédent", () => {
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "60" },
        previousCPs: [
          { brutAPayerHt: "50000", retenueGarantie: "2500", statut: "paye" },
          { brutAPayerHt: "10000", retenueGarantie: "500", statut: "brouillon" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cumulCpPrecedentsHt).toBe("50000.00");
    expect(r.data.brutAPayerHt).toBe("10000.00");
  });
});

describe("computeCP — retenue plafonnée", () => {
  it("4 CP successifs, le dernier est capé au plafond 5%", () => {
    // Marché 100k → plafond retenue = 5 000 €
    // Précédents : 3 CP × brut 30k → retenue théorique 1500 chacun = 4500
    // Donc reste 500 € de marge pour le dernier (5 000 − 4 500).
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "100" },
        previousCPs: [
          { brutAPayerHt: "30000", retenueGarantie: "1500", statut: "paye" },
          { brutAPayerHt: "30000", retenueGarantie: "1500", statut: "paye" },
          { brutAPayerHt: "30000", retenueGarantie: "1500", statut: "paye" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.brutAPayerHt).toBe("10000.00");
    // Retenue théorique = 500 € (10k × 5%), c'est pile la marge restante
    expect(r.data.retenueGarantie).toBe("500.00");
    expect(r.data.cumulRetenues).toBe("5000.00");
  });

  it("Retenue capée si cumul précédent déjà à 5%", () => {
    // Marché 100k → plafond 5 000 €. Cumul retenues précédent = 5 000.
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "100" },
        previousCPs: [
          { brutAPayerHt: "60000", retenueGarantie: "3000", statut: "paye" },
          { brutAPayerHt: "40000", retenueGarantie: "2000", statut: "paye" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.brutAPayerHt).toBe("0.00");
    expect(r.data.retenueGarantie).toBe("0.00");
    // Warning attendu : pas applicable (brut = 0 → warning "brut nul")
    expect(r.data.warnings.some((w) => w.includes("nul"))).toBe(true);
  });
});

describe("computeCP — révision BT01", () => {
  it("Révision positive +2.5% (BT01 = 1.025)", () => {
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "50" },
        revisionCoefficient: "1.025",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.brutAPayerHt).toBe("50000.00");
    expect(r.data.revisionMontantHt).toBe("1250.00");
    // montant_ht = 50k - 2500 + 1250 = 48750
    expect(r.data.montantHt).toBe("48750.00");
  });

  it("Révision négative (déflation BT01 = 0.985)", () => {
    // 50 000 × (0.985 − 1) = −750.00 (rond, pas d'arrondi à appliquer)
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "50" },
        revisionCoefficient: "0.985",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.revisionMontantHt).toBe("-750.00");
    expect(r.data.warnings.some((w) => w.includes("Révision négative"))).toBe(
      true,
    );
  });
});

describe("computeCP — TVA 10% (rénovation) vs 20% (neuf)", () => {
  it("TVA 10% sur 47 500 HT", () => {
    const r = computeCP(
      makeInput({
        lot: { ...baseLot, tauxTva: "10.00" },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.montantHt).toBe("47500.00");
    expect(r.data.tva).toBe("4750.00");
    expect(r.data.netTtc).toBe("52250.00");
  });
});

describe("computeCP — avenants signés", () => {
  it("Avenant signé augmente le plafond retenue", () => {
    const r = computeCP(
      makeInput({
        lot: {
          ...baseLot,
          avenantsSignes: [{ montantHt: "20000" }],
        },
        situation: { mode: "global", pctGlobal: "100" },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.marcheReviseHt).toBe("120000.00");
    expect(r.data.cumulTravauxHt).toBe("120000.00");
    expect(r.data.brutAPayerHt).toBe("120000.00");
    // Plafond retenue = 5% × 120k = 6 000 €
    expect(r.data.retenueGarantie).toBe("6000.00");
  });
});

describe("computeCP — arrondi centime supérieur", () => {
  it("33.3333% × 100k = 33 333.33 → arrondi 33 333.34", () => {
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "33.3333" },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cumulTravauxHt).toBe("33333.30");
    // 33 333.30 brut, retenue 5% = 1 666.67 (arrondi sup), montant HT = 31 666.63
    expect(r.data.retenueGarantie).toBe("1666.67");
  });
});

describe("computeCP — erreurs", () => {
  it("Brut négatif rejette", () => {
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "40" },
        previousCPs: [
          {
            brutAPayerHt: "50000",
            retenueGarantie: "2500",
            statut: "paye",
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.data.code).toBe("negative_brut");
  });

  it("Pct global hors range rejette", () => {
    const r = computeCP(
      makeInput({
        situation: { mode: "global", pctGlobal: "105" },
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.data.code).toBe("invalid_pct");
  });

  it("Coefficient révision aberrant rejette", () => {
    const r = computeCP(
      makeInput({
        revisionCoefficient: "11",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.data.code).toBe("invalid_coefficient");
  });
});
