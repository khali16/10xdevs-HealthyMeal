import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { RecipeDTO } from "@/types";
import { mapRecipeDtoToEditDraftVM } from "./mappers";

const createRecipeDto = (overrides: Partial<RecipeDTO> = {}): RecipeDTO =>
  ({
    id: "recipe-99",
    title: "Gofry",
    servings: 3,
    prep_time_minutes: 10,
    cook_time_minutes: 5,
    total_time_minutes: null,
    calories_per_serving: null,
    tags: { diet: "classic" },
    ingredients: [
      { text: "mąka", amount: 200, unit: "g", no_scale: false },
      { text: "mleko", amount: 300, unit: "ml" },
    ],
    steps: ["Wymieszaj", "Upiecz"],
    ...overrides,
  }) as RecipeDTO;

describe("mapRecipeDtoToEditDraftVM", () => {
  beforeEach(() => {
    let counter = 0;
    const randomUUID = vi.fn(() => `uuid-${(counter += 1)}`);
    vi.stubGlobal("crypto", { randomUUID });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps ingredients and steps with generated ids", () => {
    const dto = createRecipeDto();

    const vm = mapRecipeDtoToEditDraftVM(dto);

    expect(vm.ingredients).toEqual([
      { id: "uuid-1", text: "mąka", amount: 200, unit: "g", no_scale: false },
      { id: "uuid-2", text: "mleko", amount: 300, unit: "ml", no_scale: undefined },
    ]);
    expect(vm.steps).toEqual([
      { id: "uuid-3", text: "Wymieszaj" },
      { id: "uuid-4", text: "Upiecz" },
    ]);
  });

  it("converts nullable meta values to undefined and preserves tags", () => {
    const dto = createRecipeDto({
      prep_time_minutes: null,
      cook_time_minutes: null,
      total_time_minutes: null,
      calories_per_serving: null,
    });

    const vm = mapRecipeDtoToEditDraftVM(dto);

    expect(vm.meta).toEqual({
      servings: 3,
      prep_time_minutes: undefined,
      cook_time_minutes: undefined,
      total_time_minutes: undefined,
      calories_per_serving: undefined,
      tags: { diet: "classic" },
      total_time_minutes_mode: "auto",
    });
  });
});

describe("mapRecipeDtoToEditDraftVM (fallback ids)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("crypto", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Math.random fallback when crypto is missing", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const dto = createRecipeDto({ tags: undefined });

    const vm = mapRecipeDtoToEditDraftVM(dto);

    const expectedId = `local_${(0.123456789).toString(36).slice(2, 10)}`;
    expect(vm.ingredients[0]?.id).toBe(expectedId);
    expect(vm.meta.tags).toEqual({});
  });
});
