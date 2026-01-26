import { describe, expect, it } from "vitest";
import type { RecipeDTO } from "@/types";
import { mapRecipeDtoToDetailsVM } from "./mappers";

const createRecipeDto = (overrides: Partial<RecipeDTO> = {}): RecipeDTO =>
  ({
    id: "recipe-42",
    title: "Risotto",
    servings: 4,
    prep_time_minutes: undefined,
    cook_time_minutes: undefined,
    total_time_minutes: undefined,
    calories_per_serving: undefined,
    tags: { diet: "vegetarian", cuisine: "italian", note: "" },
    ingredients: [],
    steps: [],
    rating: undefined,
    is_favorite: undefined,
    ...overrides,
  }) as RecipeDTO;

describe("mapRecipeDtoToDetailsVM", () => {
  it("maps tags with diet and filters empty values", () => {
    const dto = createRecipeDto();

    const vm = mapRecipeDtoToDetailsVM(dto);

    expect(vm.tags).toEqual({
      diet: "vegetarian",
      other: [{ key: "cuisine", value: "italian" }],
    });
  });

  it("defaults ingredients and steps to empty arrays", () => {
    const dto = createRecipeDto({ ingredients: undefined, steps: undefined });

    const vm = mapRecipeDtoToDetailsVM(dto);

    expect(vm.ingredients).toEqual([]);
    expect(vm.steps).toEqual([]);
  });

  it("normalizes optional meta values to null", () => {
    const dto = createRecipeDto({
      prep_time_minutes: null,
      cook_time_minutes: null,
      total_time_minutes: null,
      calories_per_serving: null,
    });

    const vm = mapRecipeDtoToDetailsVM(dto);

    expect(vm.meta).toEqual({
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      caloriesPerServing: null,
      baseServings: 4,
    });
  });

  it("defaults rating and favorite flags when missing", () => {
    const dto = createRecipeDto({ rating: undefined, is_favorite: undefined, tags: {} });

    const vm = mapRecipeDtoToDetailsVM(dto);

    expect(vm.rating).toBeNull();
    expect(vm.isFavorite).toBe(false);
    expect(vm.tags).toEqual({ diet: null, other: [] });
  });
});
