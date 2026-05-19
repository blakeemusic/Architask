import { describe, expect, it } from "vitest";

import {
  assertCPWithinMarche,
  type CpValidationInput,
} from "@/lib/validation/cp";

const baseInput: CpValidationInput = {
  marcheInitialHt: "100000.00",
  avenants: [],
  existingCps: [],
  newBrutAPayerHt: "0",
};

describe("assertCPWithinMarche", () => {
  it("accepte un CP qui tient dans le marché initial", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      existingCps: [{ brutAPayerHt: "30000", statut: "signe" }],
      newBrutAPayerHt: "20000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cumulApresNouveauCpHt).toBe("50000.00");
      expect(result.data.margeRestanteHt).toBe("50000.00");
    }
  });

  it("rejette un CP qui dépasse le marché initial", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      existingCps: [{ brutAPayerHt: "80000", statut: "signe" }],
      newBrutAPayerHt: "25000", // total 105 000 > 100 000
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("cp_exceeds_marche");
      expect(result.error).toContain("dépasserait");
    }
  });

  it("avenant signé augmente le plafond", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      avenants: [{ montantHt: "15000", statut: "signe" }],
      existingCps: [{ brutAPayerHt: "100000", statut: "signe" }],
      newBrutAPayerHt: "10000", // total 110 000 ≤ 115 000 (100k + 15k)
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.marcheReviseHt).toBe("115000.00");
    }
  });

  it("avenant en brouillon ne change PAS le plafond", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      avenants: [{ montantHt: "15000", statut: "brouillon" }],
      existingCps: [{ brutAPayerHt: "100000", statut: "signe" }],
      newBrutAPayerHt: "5000", // total 105 000 > 100 000 (avenant brouillon ignoré)
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("cp_exceeds_marche");
  });

  it("CP en brouillon ne compte PAS dans le cumul", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      existingCps: [
        { brutAPayerHt: "50000", statut: "signe" },
        { brutAPayerHt: "60000", statut: "brouillon" }, // ignoré
      ],
      newBrutAPayerHt: "40000", // 50k + 40k = 90k ≤ 100k
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.cumulCpExistantsHt).toBe("50000.00");
  });

  it("travaux suppl. acceptés augmentent le plafond", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      travauxSupplAcceptesHt: "5000",
      existingCps: [{ brutAPayerHt: "100000", statut: "signe" }],
      newBrutAPayerHt: "4000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.marcheReviseHt).toBe("105000.00");
  });

  it("avenant négatif diminue le plafond", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      avenants: [{ montantHt: "-10000", statut: "signe" }],
      existingCps: [{ brutAPayerHt: "85000", statut: "signe" }],
      newBrutAPayerHt: "10000", // 95k > 90k → reject
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("cp_exceeds_marche");
  });

  it("rejette un montant négatif", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      newBrutAPayerHt: "-100",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("cp_negative_amount");
  });

  it("précision financière : pas de float drift", () => {
    const result = assertCPWithinMarche({
      ...baseInput,
      marcheInitialHt: "100000.00",
      existingCps: [
        { brutAPayerHt: "33333.33", statut: "signe" },
        { brutAPayerHt: "33333.33", statut: "signe" },
      ],
      newBrutAPayerHt: "33333.34", // total 100 000.00 exactement
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.cumulApresNouveauCpHt).toBe("100000.00");
  });
});
