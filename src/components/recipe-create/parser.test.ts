import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseRawRecipeToDraft } from "./parser";

const createUuidStub = () => {
  let counter = 1;
  return vi.fn(() => `uuid-${counter++}`);
};

beforeEach(() => {
  const randomUUID = createUuidStub();
  vi.stubGlobal("crypto", { randomUUID });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseRawRecipeToDraft", () => {
  it("parses headers, normalizes units, and calculates confidences", () => {
    const raw = [
      "Tarta z jablkami",
      "Składniki:",
      "1 kg mąki",
      "1/2 l mleka",
      "2 szt jajka",
      "Kroki:",
      "1. Wymieszaj",
      "2) Piecz",
    ].join("\n");

    const result = parseRawRecipeToDraft(raw);

    expect(result.warnings).toEqual([]);
    expect(result.confidences).toEqual({
      title: 0.95,
      ingredients: 0.9,
      steps: 0.9,
    });
    expect(result.draftPatch.title).toEqual({
      value: "Tarta z jablkami",
      confidence: 0.95,
      source: "parsed",
    });

    expect(result.draftPatch.ingredients?.map((item) => item.value)).toEqual([
      {
        id: "uuid-1",
        text: "1000 g mąki",
        amount: 1000,
        unit: "g",
        confidence: 0.92,
      },
      {
        id: "uuid-2",
        text: "500 ml mleka",
        amount: 500,
        unit: "ml",
        confidence: 0.92,
      },
      {
        id: "uuid-3",
        text: "2 szt jajka",
        amount: 2,
        unit: "szt",
        confidence: 0.92,
      },
    ]);

    expect(result.draftPatch.steps?.map((item) => item.value)).toEqual([
      { id: "uuid-4", text: "Wymieszaj", confidence: 0.9 },
      { id: "uuid-5", text: "Piecz", confidence: 0.9 },
    ]);
  });

  it("keeps ingredient text when amount or unit is invalid", () => {
    const raw = ["Danie", "Składniki:", "1 xyz cukru", "Kroki:", "Wymieszaj"].join(
      "\n"
    );

    const result = parseRawRecipeToDraft(raw);
    const [ingredient] = result.draftPatch.ingredients ?? [];

    expect(ingredient?.value).toEqual({
      id: "uuid-1",
      text: "1 xyz cukru",
      confidence: 0.6,
    });
  });

  it("falls back to positional parsing when sections are missing", () => {
    const raw = [
      "Chleb",
      "1 kg mąki",
      "2 szt jajka",
      "300 ml wody",
      "Sól",
      "Drożdże",
      "Wymieszaj",
      "Upiecz",
    ].join("\n");

    const result = parseRawRecipeToDraft(raw);

    expect(result.draftPatch.title?.value).toBe("Chleb");
    expect(result.draftPatch.ingredients).toHaveLength(5);
    expect(result.draftPatch.steps).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it("adds warnings when steps or ingredients are missing", () => {
    const raw = ["Tylko tytul", "1 kg mąki"].join("\n");

    const result = parseRawRecipeToDraft(raw);

    expect(result.warnings).toEqual(["Nie wykryto listy kroków."]);
    expect(result.confidences).toEqual({
      title: 0.95,
      ingredients: 0.65,
      steps: 0.3,
    });
  });
});
