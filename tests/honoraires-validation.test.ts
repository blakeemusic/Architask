import { describe, expect, it } from "vitest";

import {
  assertAvancementMonotone,
  assertMissionsSumValid,
  type MissionForValidation,
} from "@/lib/validation/honoraires";

describe("assertMissionsSumValid (mode pct)", () => {
  it("accepte Σ % = 100", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "pct", pctDuTotal: "30" },
      { typeValeur: "pct", pctDuTotal: "45" },
      { typeValeur: "pct", pctDuTotal: "25" },
    ];
    const result = assertMissionsSumValid(missions, "100000");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.modeDetected).toBe("pct");
      expect(result.data.sum).toBe("100.00");
    }
  });

  it("rejette Σ % = 99 (sous 100)", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "pct", pctDuTotal: "50" },
      { typeValeur: "pct", pctDuTotal: "49" },
    ];
    const result = assertMissionsSumValid(missions, "100000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missions_pct_not_100");
  });

  it("rejette Σ % = 101 (au-dessus)", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "pct", pctDuTotal: "60" },
      { typeValeur: "pct", pctDuTotal: "41" },
    ];
    const result = assertMissionsSumValid(missions, "100000");
    expect(result.ok).toBe(false);
  });

  it("tolère ±0.01 sur Σ % (arrondi)", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "pct", pctDuTotal: "33.33" },
      { typeValeur: "pct", pctDuTotal: "33.33" },
      { typeValeur: "pct", pctDuTotal: "33.34" },
    ];
    const result = assertMissionsSumValid(missions, "100000");
    expect(result.ok).toBe(true);
  });
});

describe("assertMissionsSumValid (mode montant)", () => {
  it("accepte Σ montants = total contrat", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "montant", montantHt: "3000" },
      { typeValeur: "montant", montantHt: "7000" },
    ];
    const result = assertMissionsSumValid(missions, "10000");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.modeDetected).toBe("montant");
  });

  it("rejette Σ montants ≠ total contrat", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "montant", montantHt: "3000" },
      { typeValeur: "montant", montantHt: "5000" },
    ];
    const result = assertMissionsSumValid(missions, "10000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missions_total_mismatch");
  });
});

describe("assertMissionsSumValid (validation transversale)", () => {
  it("rejette liste vide", () => {
    const result = assertMissionsSumValid([], "10000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missions_empty");
  });

  it("rejette mode mixte (pct + montant)", () => {
    const missions: MissionForValidation[] = [
      { typeValeur: "pct", pctDuTotal: "50" },
      { typeValeur: "montant", montantHt: "5000" },
    ];
    const result = assertMissionsSumValid(missions, "10000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missions_mixed_types");
  });
});

describe("assertAvancementMonotone", () => {
  it("accepte une progression (50 → 75)", () => {
    const result = assertAvancementMonotone("50", "75");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.delta).toBe("25.00");
  });

  it("accepte un avancement identique (idempotent)", () => {
    const result = assertAvancementMonotone("100", "100");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.delta).toBe("0.00");
  });

  it("rejette un retour en arrière (75 → 50)", () => {
    const result = assertAvancementMonotone("75", "50");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("avancement_decreased");
  });

  it("rejette un avancement hors range (>100)", () => {
    const result = assertAvancementMonotone("50", "105");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("avancement_out_of_range");
  });

  it("rejette un avancement négatif", () => {
    const result = assertAvancementMonotone("0", "-5");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("avancement_out_of_range");
  });
});
