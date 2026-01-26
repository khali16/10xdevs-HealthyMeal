import { describe, expect, it } from "vitest";
import type { RecipeEditDraftVM } from "./types";
import { validateDraft } from "./validation";

const createDraft = (overrides: Partial<RecipeEditDraftVM> = {}): RecipeEditDraftVM => ({
  title: "Test recipe",
  ingredients: [{ id: "ing-1", text: "Mąka", amount: 200, unit: "g" }],
  steps: [{ id: "step-1", text: "Wymieszaj składniki." }],
  meta: { servings: 2, tags: {} },
  ...overrides,
});

const repeat = (value: string, length: number) => value.repeat(length);

describe("validateDraft", () => {
  it("returns empty errors for valid draft", () => {
    const errors = validateDraft(createDraft());

    expect(errors).toEqual({});
  });

  it("validates required and max length fields", () => {
    const draft = createDraft({
      title: " ",
      ingredients: [{ id: "ing-1", text: " ".repeat(2) }],
      steps: [{ id: "step-1", text: " ".repeat(3) }],
    });

    const errors = validateDraft(draft);

    expect(errors).toMatchInlineSnapshot(`
      {
        "ingredientsById": {
          "ing-1": {
            "text": "Uzupełnij nazwę składnika.",
          },
        },
        "stepsById": {
          "step-1": {
            "text": "Uzupełnij treść kroku.",
          },
        },
        "title": "Tytuł jest wymagany.",
      }
    `);
  });

  it("validates ingredient limits, amount, and unit", () => {
    const longText = repeat("a", 501);
    const longUnit = repeat("u", 51);
    const ingredients = Array.from({ length: 201 }, (_, index) => ({
      id: `ing-${index}`,
      text: "Składnik",
    }));

    const draft = createDraft({
      ingredients: [
        { id: "ing-1", text: longText },
        { id: "ing-2", text: "Cukier", amount: Number.NaN },
        { id: "ing-3", text: "Sól", amount: 1_000_001 },
        { id: "ing-4", text: "Woda", unit: " " },
        { id: "ing-5", text: "Mleko", unit: longUnit },
        ...ingredients,
      ],
    });

    const errors = validateDraft(draft);

    expect(errors.ingredients).toBe("Maksymalna liczba składników to 200.");
    expect(errors.ingredientsById).toMatchInlineSnapshot(`
      {
        "ing-1": {
          "text": "Maksymalna długość to 500 znaków.",
        },
        "ing-2": {
          "amount": "Wpisz poprawną liczbę.",
        },
        "ing-3": {
          "amount": "Wartość musi być w zakresie 0–1000000.",
        },
        "ing-4": {
          "unit": "Usuń pustą jednostkę.",
        },
        "ing-5": {
          "unit": "Maksymalnie 50 znaków.",
        },
      }
    `);
  });

  it("validates steps count and text length", () => {
    const steps = Array.from({ length: 201 }, (_, index) => ({
      id: `step-${index}`,
      text: "Opis kroku",
    }));

    const draft = createDraft({
      steps: [{ id: "step-1", text: repeat("x", 501) }, ...steps],
    });

    const errors = validateDraft(draft);

    expect(errors.steps).toBe("Maksymalna liczba kroków to 200.");
    expect(errors.stepsById).toMatchInlineSnapshot(`
      {
        "step-1": {
          "text": "Maksymalna długość to 500 znaków.",
        },
      }
    `);
  });

  it("validates servings and meta numeric ranges", () => {
    const draft = createDraft({
      meta: {
        servings: 0,
        prep_time_minutes: -1,
        cook_time_minutes: 1001,
        total_time_minutes: 2001,
        calories_per_serving: 100001,
        tags: {},
      },
    });

    const errors = validateDraft(draft);

    expect(errors).toMatchInlineSnapshot(`
      {
        "calories_per_serving": "Kalorie 0–100000.",
        "cook_time_minutes": "Czas gotowania 0–1000 min.",
        "prep_time_minutes": "Czas przygotowania 0–1000 min.",
        "servings": "Liczba porcji musi być w zakresie 1–10000.",
        "total_time_minutes": "Czas całkowity 0–2000 min.",
      }
    `);
  });

  it("ignores empty tags but flags too long tag values", () => {
    const draft = createDraft({
      meta: {
        servings: 2,
        tags: {
          diet: " ",
          cuisine: repeat("t", 101),
        },
      },
    });

    const errors = validateDraft(draft);

    expect(errors.tags).toBe("Tagi mogą mieć maksymalnie 100 znaków.");
  });
});
