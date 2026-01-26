import { describe, expect, it } from "vitest";
import type { RecipeDTO } from "@/types";
import { mapRecipeDtoToCardVM } from "./mappers";

const createRecipeDto = (overrides: Partial<RecipeDTO> = {}): RecipeDTO =>
  ({
    id: "recipe-1",
    title: "Test recipe",
    servings: 2,
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    total_time_minutes: null,
    calories_per_serving: 450,
    tags: { diet: "vegan" },
    ingredients: [],
    steps: [],
    rating: 4.5,
    is_favorite: true,
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }) as RecipeDTO;

describe("mapRecipeDtoToCardVM", () => {
  it("uses explicit total_time_minutes when provided", () => {
    const dto = createRecipeDto({ total_time_minutes: 55 });

    const vm = mapRecipeDtoToCardVM(dto);

    expect(vm.totalTimeMinutes).toBe(55);
  });

  it("calculates total time from prep and cook when missing", () => {
    const dto = createRecipeDto({ total_time_minutes: null, prep_time_minutes: 5, cook_time_minutes: 15 });

    const vm = mapRecipeDtoToCardVM(dto);

    expect(vm.totalTimeMinutes).toBe(20);
  });

  it("falls back to null when prep or cook is missing", () => {
    const dto = createRecipeDto({ total_time_minutes: null, prep_time_minutes: 10, cook_time_minutes: null });

    const vm = mapRecipeDtoToCardVM(dto);

    expect(vm.totalTimeMinutes).toBeNull();
  });

  it("normalizes optional fields and defaults", () => {
    const dto = createRecipeDto({
      tags: {},
      rating: undefined,
      is_favorite: undefined,
      calories_per_serving: null,
      updated_at: null,
    });

    const vm = mapRecipeDtoToCardVM(dto);

    expect(vm).toEqual({
      id: "recipe-1",
      title: "Test recipe",
      dietLabel: null,
      totalTimeMinutes: 30,
      caloriesPerServing: null,
      rating: null,
      isFavorite: false,
      updatedAt: undefined,
    });
  });
});
