## API Endpoint Implementation Plan: POST /api/recipes

### 1. Przegląd punktu końcowego
Punkt końcowy tworzy nowy przepis dla zalogowanego użytkownika. Waliduje dane wejściowe, zapisuje rekord w tabeli `recipes`, a następnie zwraca utworzony obiekt w formacie `RecipeDTO`. W przypadku sukcesu zwraca 201 oraz nagłówek `Location` wskazujący zasób `GET /api/recipes/{id}`.

### 2. Szczegóły żądania
- **Metoda HTTP**: POST
- **Struktura URL**: `/api/recipes`
- **Parametry URL**: brak
- **Query params**: brak
- **Nagłówki**:
  - `Content-Type: application/json`
  - Sesja/ciasteczko Supabase (autoryzacja poprzez `locals.supabase`)
- **Request Body**: `CreateRecipeCommand`
  - Pola: `title`, `ingredients[]`, `steps[]`, `tags{}`, `prep_time_minutes?`, `cook_time_minutes?`, `total_time_minutes?`, `calories_per_serving?`, `servings`
  - Przykład:
```json
{
  "title": "Tofu Stir Fry",
  "ingredients": [
    { "text": "200 g tofu", "unit": "g", "amount": 200, "no_scale": false }
  ],
  "steps": ["Press tofu", "Stir fry"],
  "tags": { "diet": "vegan", "course": "dinner" },
  "prep_time_minutes": 10,
  "cook_time_minutes": 15,
  "total_time_minutes": 25,
  "calories_per_serving": 450,
  "servings": 2
}
```

### 3. Wykorzystywane typy
- Z `src/types.ts`:
  - `CreateRecipeCommand`, `RecipeDTO`, `RecipeIngredientDTO`, `RecipeTags`
  - `ApiSuccess<T>`, `ApiError`
- Z `src/db/database.types.ts` (pośrednio): `Tables<'recipes'>`

### 4. Szczegóły odpowiedzi
- **201 Created**: `ApiSuccess<RecipeDTO>` + `Location: /api/recipes/{id}`
- **400 Bad Request**: `ApiError` dla błędów walidacji/JSON
- **401 Unauthorized**: `ApiError` gdy brak sesji
- **500 Internal Server Error**: `ApiError` dla nieoczekiwanych błędów

Przykład 201:
```json
{
  "data": {
    "id": "d2d9e7d0-...",
    "user_id": "1a2b3c-...",
    "title": "Tofu Stir Fry",
    "ingredients": [{ "text": "200 g tofu", "unit": "g", "amount": 200 }],
    "steps": ["Press tofu", "Stir fry"],
    "tags": { "diet": "vegan", "course": "dinner" },
    "prep_time_minutes": 10,
    "cook_time_minutes": 15,
    "total_time_minutes": 25,
    "calories_per_serving": 450,
    "servings": 2,
    "is_ai_adjusted": false,
    "original_recipe_id": null,
    "confidence_score": null,
    "created_at": "2025-01-21T10:00:00Z",
    "updated_at": "2025-01-21T10:00:00Z",
    "deleted_at": null,
    "rating": null,
    "is_favorite": false
  }
}
```

### 5. Przepływ danych
1. Klient wysyła `POST /api/recipes` z `CreateRecipeCommand` w body.
2. Middleware udostępnia `locals.supabase` (zalogowany użytkownik).
3. Handler `POST`:
   - Parsuje JSON (z obsługą błędów 400 dla niepoprawnego JSON).
   - Waliduje payload Zod-em zgodnie z typami i ograniczeniami DB.
   - Pobiera `userId` z `locals.supabase.auth.getUser()`.
   - Uzupełnia `total_time_minutes` jeśli pominięte (z `prep` + `cook`).
   - Wywołuje `recipesService.createRecipe` zapisujące rekord w `recipes`.
   - Mapuje wiersz na `RecipeDTO`, zwraca 201 + `Location`.

### 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagane – sesja Supabase przez `locals.supabase`.
- **Autoryzacja**: zapis ograniczony do `user_id` bieżącego użytkownika; rely on RLS.
- **Walidacja wejścia**: Zod (limity długości i zakresów, trimming stringów).
- **Nadużycia**: limit rozmiaru body; opcjonalny rate limiting w middleware.
- **Sekrety**: brak w treści; użycie `import.meta.env` jeśli potrzebne.

### 7. Obsługa błędów
- 400: błędy walidacji Zod (z `fieldErrors`), niepoprawny JSON.
- 401: brak użytkownika w sesji.
- 500: nieoczekiwane błędy (DB/serwer). Log na serwerze. Brak dedykowanej tabeli błędów – nie zapisujemy.

### 8. Rozważania dotyczące wydajności
- Kontrola rozmiaru pól JSONB (`ingredients`, `steps`, `tags`) poprzez walidację (max elementów i długości tekstu).
- Pojedyncze `insert` + `select("*").single()` – minimalne round-trip-y.
- Brak dodatkowych joinów; mapping w pamięci.

### 9. Kroki implementacji
1. **Walidacja (Zod)** – `src/lib/validation/recipes.ts`:
   - `recipeIngredientSchema`, `recipeTagsSchema`, `createRecipeCommandSchema`.
2. **Serwis domenowy** – `src/lib/services/recipes.service.ts`:
   - `createRecipe(supabase, userId, cmd)` – liczenie `total_time_minutes`, `insert` do `recipes`, `mapRecipeRowToDTO`.
3. **Endpoint API** – `src/pages/api/recipes/index.ts`:
   - `export const prerender = false`.
   - `export const POST` – pobranie sesji, walidacja, wywołanie serwisu, zwrot 201 + `Location`.
4. **Typy** – użycie istniejących z `src/types.ts` (bez zmian).
5. **Testy ręczne** – przypadki sukcesu, błędny JSON, walidacja, brak sesji.

### 10. Szkice (orientacyjne)

Walidacja (Zod):
```ts
// src/lib/validation/recipes.ts
import { z } from 'zod'

export const recipeIngredientSchema = z.object({
  text: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(50).optional(),
  amount: z.number().finite().nonnegative().max(1_000_000).optional(),
  no_scale: z.boolean().optional(),
})

export const recipeTagsSchema = z.record(z.string().trim().max(100))

export const createRecipeCommandSchema = z.object({
  title: z.string().trim().min(1).max(255),
  ingredients: z.array(recipeIngredientSchema).min(1).max(200),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(200),
  tags: recipeTagsSchema.default({}),
  prep_time_minutes: z.number().int().nonnegative().max(1_000).nullable().optional(),
  cook_time_minutes: z.number().int().nonnegative().max(1_000).nullable().optional(),
  total_time_minutes: z.number().int().nonnegative().max(2_000).nullable().optional(),
  calories_per_serving: z.number().int().nonnegative().max(100_000).nullable().optional(),
  servings: z.number().int().positive().max(10_000),
})
```

Serwis:
```ts
// src/lib/services/recipes.service.ts
import type { SupabaseClient } from '@/db/supabase.client'
import type { CreateRecipeCommand, RecipeDTO } from '@/types'

export async function createRecipe(
  supabase: SupabaseClient,
  userId: string,
  cmd: CreateRecipeCommand,
): Promise<RecipeDTO> {
  const total = cmd.total_time_minutes ?? (
    cmd.prep_time_minutes != null && cmd.cook_time_minutes != null
      ? cmd.prep_time_minutes + cmd.cook_time_minutes
      : null
  )

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: cmd.title,
      ingredients: cmd.ingredients,
      steps: cmd.steps,
      tags: cmd.tags,
      prep_time_minutes: cmd.prep_time_minutes ?? null,
      cook_time_minutes: cmd.cook_time_minutes ?? null,
      total_time_minutes: total,
      calories_per_serving: cmd.calories_per_serving ?? null,
      servings: cmd.servings,
    })
    .select('*')
    .single()

  if (error) throw error

  return mapRecipeRowToDTO(data)
}

function mapRecipeRowToDTO(row: any): RecipeDTO {
  return {
    ...row,
    rating: null,
    is_favorite: false,
  }
}
```

Endpoint API:
```ts
// src/pages/api/recipes/index.ts
import type { APIRoute } from 'astro'
import { createRecipeCommandSchema } from '@/lib/validation/recipes'
import { createRecipe } from '@/lib/services/recipes.service'
import type { ApiError } from '@/types'

export const prerender = false

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase
  const { data: session } = await supabase.auth.getUser()
  if (!session?.user) {
    return new Response(JSON.stringify(<ApiError>{
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    }), { status: 401 })
  }

  let payload
  try {
    payload = await context.request.json()
  } catch {
    return new Response(JSON.stringify(<ApiError>{
      error: { code: 'BAD_REQUEST', message: 'Invalid JSON' },
    }), { status: 400 })
  }

  const parsed = createRecipeCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(JSON.stringify(<ApiError>{
      error: {
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      },
    }), { status: 400 })
  }

  try {
    const dto = await createRecipe(supabase, session.user.id, parsed.data)
    const body = JSON.stringify({ data: dto })
    return new Response(body, {
      status: 201,
      headers: { Location: `/api/recipes/${dto.id}`, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Create recipe failed', e)
    return new Response(JSON.stringify(<ApiError>{
      error: { code: 'INTERNAL', message: 'Internal Server Error' },
    }), { status: 500 })
  }
}
```

Uwagi:
- Używaj `locals.supabase` i typu `SupabaseClient` z `src/db/supabase.client.ts`.
- Zgodność z regułami: Zod, `export const prerender = false`, właściwe kody statusu.
- Schemat DB już wspiera wymagane pola (JSONB dla `ingredients`, `steps`, `tags`).
