# API Endpoint Implementation Plan: Ratings and Favorites

## 1. Przegląd punktu końcowego

Ten plan obejmuje implementację trzech endpointów API związanych z ocenami i ulubionymi przepisami:

1. **PUT /api/recipes/{id}/rating** - Tworzenie/aktualizacja oceny przepisu przez użytkownika (1-5)
2. **DELETE /api/recipes/{id}/rating** - Usunięcie oceny przepisu przez użytkownika
3. **PUT /api/recipes/{id}/favorite** - Ustawienie/usuń flagi ulubionego przepisu

Wszystkie endpointy wymagają autentykacji użytkownika i operują na relacjach między użytkownikiem a przepisem. Endpointy wykorzystują tabele `recipe_ratings` i `recipe_favorites` w bazie danych Supabase z włączonym RLS (Row Level Security).

## 2. Szczegóły żądania

### 2.1 PUT /api/recipes/{id}/rating

- **Metoda HTTP**: PUT
- **Struktura URL**: `/api/recipes/{id}/rating`
- **Parametry**:
  - **Wymagane**: `id` (UUID przepisu w ścieżce URL)
- **Request Body**:
  ```json
  {
    "rating": 4
  }
  ```
  - `rating` (wymagane): liczba całkowita z zakresu 1-5
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane)
  - `Content-Type: application/json`

### 2.2 DELETE /api/recipes/{id}/rating

- **Metoda HTTP**: DELETE
- **Struktura URL**: `/api/recipes/{id}/rating`
- **Parametry**:
  - **Wymagane**: `id` (UUID przepisu w ścieżce URL)
- **Request Body**: Brak
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane)

### 2.3 PUT /api/recipes/{id}/favorite

- **Metoda HTTP**: PUT
- **Struktura URL**: `/api/recipes/{id}/favorite`
- **Parametry**:
  - **Wymagane**: `id` (UUID przepisu w ścieżce URL)
- **Request Body**:
  ```json
  {
    "favorite": true
  }
  ```
  - `favorite` (wymagane): wartość boolean
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane)
  - `Content-Type: application/json`

## 3. Wykorzystywane typy

### 3.1 Command Modele (z `src/types.ts`)

```typescript
export type PutRecipeRatingCommand = { rating: number }
export type PutRecipeFavoriteCommand = { favorite: boolean }
```

### 3.2 DTO Modele (z `src/types.ts`)

```typescript
export type RecipeRatingDTO = { recipe_id: UUID; rating: number }
export type RecipeFavoriteDTO = { recipe_id: UUID; favorite: boolean }
```

### 3.3 Typy bazy danych

Z `src/db/database.types.ts`:
- `recipe_ratings` - tabela z polami: `id`, `user_id`, `recipe_id`, `rating`, `created_at`, `updated_at`
- `recipe_favorites` - tabela z polami: `id`, `user_id`, `recipe_id`, `created_at`

### 3.4 Typy błędów

```typescript
export type ApiError = {
  error: {
    code: string
    message: string
    details?: unknown
    fieldErrors?: Record<string, string[]>
  }
}
```

## 4. Szczegóły odpowiedzi

### 4.1 PUT /api/recipes/{id}/rating

**Sukces (200)**:
```json
{
  "data": {
    "recipe_id": "uuid",
    "rating": 4
  }
}
```

**Błędy**:
- **400**: Nieprawidłowy JSON lub brak pola `rating` w body
- **401**: Brak autoryzacji (brak tokena lub nieprawidłowy token)
- **404**: Przepis o podanym ID nie istnieje lub użytkownik nie ma do niego dostępu
- **422**: Wartość `rating` poza zakresem 1-5
- **500**: Błąd serwera

### 4.2 DELETE /api/recipes/{id}/rating

**Sukces (204)**: Brak treści odpowiedzi

**Błędy**:
- **401**: Brak autoryzacji
- **404**: Przepis o podanym ID nie istnieje, użytkownik nie ma do niego dostępu, lub ocena nie istnieje
- **500**: Błąd serwera

### 4.3 PUT /api/recipes/{id}/favorite

**Sukces (200)**:
```json
{
  "data": {
    "recipe_id": "uuid",
    "favorite": true
  }
}
```

**Błędy**:
- **400**: Nieprawidłowy JSON lub brak pola `favorite` w body
- **401**: Brak autoryzacji
- **404**: Przepis o podanym ID nie istnieje lub użytkownik nie ma do niego dostępu
- **500**: Błąd serwera

## 5. Przepływ danych

### 5.1 PUT /api/recipes/{id}/rating

1. Klient wysyła `PUT /api/recipes/{id}/rating` z `PutRecipeRatingCommand` w body i tokenem JWT w nagłówku `Authorization`
2. Middleware udostępnia `locals.supabase` (klient Supabase z kontekstem użytkownika)
3. Handler `PUT`:
   - Parsuje `id` z parametrów ścieżki
   - Pobiera użytkownika z sesji: `const { data: { user } } = await supabase.auth.getUser()`
   - Jeśli brak użytkownika → zwraca 401
   - Parsuje JSON z body (obsługa błędów 400 dla niepoprawnego JSON)
   - Waliduje payload za pomocą Zod (sprawdzenie zakresu 1-5 dla `rating`)
   - Jeśli walidacja nie powiodła się → zwraca 422 z `fieldErrors`
   - Sprawdza istnienie przepisu: wywołuje `getRecipeById(supabase, user.id, id)`
   - Jeśli przepis nie istnieje → zwraca 404
   - Wywołuje `ratingsService.upsertRating(supabase, user.id, recipeId, rating)`:
     - Wykonuje `upsert` na tabeli `recipe_ratings` z `user_id`, `recipe_id`, `rating`
     - Aktualizuje `updated_at` przy aktualizacji istniejącego rekordu
   - Zwraca 200 z `RecipeRatingDTO`

### 5.2 DELETE /api/recipes/{id}/rating

1. Klient wysyła `DELETE /api/recipes/{id}/rating` z tokenem JWT
2. Handler `DELETE`:
   - Parsuje `id` z parametrów ścieżki
   - Pobiera użytkownika z sesji
   - Jeśli brak użytkownika → zwraca 401
   - Sprawdza istnienie przepisu
   - Jeśli przepis nie istnieje → zwraca 404
   - Wywołuje `ratingsService.deleteRating(supabase, user.id, recipeId)`:
     - Usuwa rekord z `recipe_ratings` gdzie `user_id = user.id` AND `recipe_id = recipeId`
     - Jeśli rekord nie istnieje → zwraca 404
   - Zwraca 204 (No Content)

### 5.3 PUT /api/recipes/{id}/favorite

1. Klient wysyła `PUT /api/recipes/{id}/favorite` z `PutRecipeFavoriteCommand` w body
2. Handler `PUT`:
   - Parsuje `id` z parametrów ścieżki
   - Pobiera użytkownika z sesji
   - Jeśli brak użytkownika → zwraca 401
   - Parsuje JSON z body
   - Waliduje payload za pomocą Zod (sprawdzenie typu boolean dla `favorite`)
   - Sprawdza istnienie przepisu
   - Jeśli przepis nie istnieje → zwraca 404
   - Wywołuje `favoritesService.setFavorite(supabase, user.id, recipeId, favorite)`:
     - Jeśli `favorite === true`: wykonuje `upsert` na tabeli `recipe_favorites`
     - Jeśli `favorite === false`: usuwa rekord z `recipe_favorites` (jeśli istnieje)
   - Zwraca 200 z `RecipeFavoriteDTO`

## 6. Względy bezpieczeństwa

### 6.1 Uwierzytelnianie

- **Wymagane**: Wszystkie endpointy wymagają autoryzacji przez Bearer JWT token
- **Weryfikacja**: Użycie `supabase.auth.getUser()` do weryfikacji tokena i pobrania `user_id`
- **Brak autoryzacji**: Zwracanie 401 z komunikatem `{ "error": { "code": "UNAUTHORIZED", "message": "Unauthorized" } }`

### 6.2 Autoryzacja i RLS

- **Row Level Security**: Tabele `recipe_ratings` i `recipe_favorites` mają włączone RLS
- **Dostęp do przepisów**: Użytkownik może oceniać/oznaczać jako ulubione tylko przepisy, do których ma dostęp (sprawdzenie przez `getRecipeById`)
- **Izolacja danych**: RLS zapewnia, że użytkownik widzi tylko swoje oceny i ulubione
- **Foreign Key Constraints**: Baza danych zapewnia integralność referencyjną (CASCADE przy usuwaniu użytkownika lub przepisu)

### 6.3 Walidacja danych wejściowych

- **Zod schemas**: Walidacja wszystkich danych wejściowych za pomocą schematów Zod
- **Rating range**: Sprawdzenie zakresu 1-5 dla oceny (również w bazie przez CHECK constraint)
- **UUID validation**: Walidacja formatu UUID dla `recipe_id` w ścieżce
- **Type safety**: Wykorzystanie TypeScript do zapewnienia bezpieczeństwa typów

### 6.4 Ochrona przed nadużyciami

- **Rate limiting**: Middleware zapewnia globalny limit 120 requestów/min/IP
- **Payload size**: Middleware ogranicza rozmiar body do 256 KB
- **SQL Injection**: Supabase client używa parametrówzowanych zapytań
- **XSS**: Brak renderowania danych użytkownika w odpowiedziach JSON

### 6.5 Idempotencja

- **PUT rating**: Operacja jest idempotentna dzięki `UNIQUE(user_id, recipe_id)` - wielokrotne wywołania z tymi samymi danymi dają ten sam wynik
- **PUT favorite**: Operacja jest idempotentna - ustawienie `favorite: true` wielokrotnie nie zmienia stanu

## 7. Obsługa błędów

### 7.1 Scenariusze błędów i kody statusu

| Scenariusz | Kod statusu | Struktura odpowiedzi |
|------------|-------------|----------------------|
| Brak tokena autoryzacji | 401 | `{ "error": { "code": "UNAUTHORIZED", "message": "Unauthorized" } }` |
| Nieprawidłowy/nieaktualny token | 401 | `{ "error": { "code": "UNAUTHORIZED", "message": "Unauthorized" } }` |
| Brak parametru `id` w URL | 400 | `{ "error": { "code": "BAD_REQUEST", "message": "Missing id" } }` |
| Nieprawidłowy format UUID | 400 | `{ "error": { "code": "BAD_REQUEST", "message": "Invalid recipe id format" } }` |
| Nieprawidłowy JSON w body | 400 | `{ "error": { "code": "BAD_REQUEST", "message": "Invalid JSON" } }` |
| Brak pola `rating` w body (PUT rating) | 400 | `{ "error": { "code": "BAD_REQUEST", "message": "Validation failed", "fieldErrors": { "rating": ["Required"] } } }` |
| Brak pola `favorite` w body (PUT favorite) | 400 | `{ "error": { "code": "BAD_REQUEST", "message": "Validation failed", "fieldErrors": { "favorite": ["Required"] } } }` |
| `rating` poza zakresem 1-5 | 422 | `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "fieldErrors": { "rating": ["Rating must be between 1 and 5"] } } }` |
| `favorite` nie jest boolean | 422 | `{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "fieldErrors": { "favorite": ["Expected boolean"] } } }` |
| Przepis nie istnieje | 404 | `{ "error": { "code": "NOT_FOUND", "message": "Recipe not found" } }` |
| Użytkownik nie ma dostępu do przepisu | 404 | `{ "error": { "code": "NOT_FOUND", "message": "Recipe not found" } }` |
| Ocena nie istnieje (DELETE rating) | 404 | `{ "error": { "code": "NOT_FOUND", "message": "Rating not found" } }` |
| Błąd bazy danych | 500 | `{ "error": { "code": "INTERNAL", "message": "Internal Server Error" } }` |
| Nieoczekiwany błąd | 500 | `{ "error": { "code": "INTERNAL", "message": "Internal Server Error" } }` |

### 7.2 Logowanie błędów

- **Console.error**: Wszystkie błędy są logowane na serwerze za pomocą `console.error()` z kontekstem
- **Brak tabeli błędów**: Zgodnie z regułami projektu, błędy nie są zapisywane do dedykowanej tabeli błędów
- **Format logów**: `console.error('Operation failed', { error: e, userId, recipeId, operation })`

### 7.3 Mapowanie błędów bazy danych

- **Foreign key violation (23503)**: Mapowane na 404 (przepis nie istnieje)
- **Unique constraint violation (23505)**: Dla `recipe_ratings` i `recipe_favorites` - nie powinno wystąpić dzięki użyciu `upsert`, ale jeśli wystąpi → 409 Conflict
- **Check constraint violation**: Dla `rating` poza zakresem → 422 (powinno być złapane przez walidację Zod, ale jako fallback)

## 8. Rozważania dotyczące wydajności

### 8.1 Indeksy bazy danych

Tabele mają już zdefiniowane indeksy:
- `idx_recipe_ratings_user_id` na `recipe_ratings(user_id)`
- `idx_recipe_ratings_recipe_id` na `recipe_ratings(recipe_id)`
- `idx_recipe_favorites_user_id` na `recipe_favorites(user_id)`
- `idx_recipe_favorites_recipe_id` na `recipe_favorites(recipe_id)`
- `UNIQUE(user_id, recipe_id)` zapewnia również wydajne wyszukiwanie

### 8.2 Optymalizacje zapytań

- **Upsert zamiast SELECT + INSERT/UPDATE**: Wykorzystanie `upsert()` Supabase dla operacji PUT, co eliminuje potrzebę osobnych zapytań SELECT
- **Sprawdzanie istnienia przepisu**: Użycie `getRecipeById` z `.maybeSingle()` zamiast `.single()` dla lepszej obsługi braku rekordu
- **Minimalne zapytania**: DELETE używa bezpośredniego `.delete()` z warunkami, bez wcześniejszego SELECT

### 8.3 Potencjalne wąskie gardła

- **Weryfikacja przepisu**: Każda operacja wymaga sprawdzenia istnienia przepisu - można rozważyć cache, ale dla MVP nie jest konieczne
- **Rate limiting**: Middleware zapewnia ochronę przed nadmiernym obciążeniem
- **RLS overhead**: RLS dodaje niewielki overhead do każdego zapytania, ale jest akceptowalny dla bezpieczeństwa

### 8.4 Caching

- **Brak cache**: Endpointy modyfikujące dane nie powinny być cache'owane
- **ETag/If-None-Match**: Nie dotyczy endpointów modyfikujących

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematów walidacji Zod

**Plik**: `src/lib/validation/recipes.ts`

- Dodać schemat `putRecipeRatingCommandSchema`:
  ```typescript
  export const putRecipeRatingCommandSchema = z.object({
    rating: z.number().int().min(1).max(5),
  })
  ```

- Dodać schemat `putRecipeFavoriteCommandSchema`:
  ```typescript
  export const putRecipeFavoriteCommandSchema = z.object({
    favorite: z.boolean(),
  })
  ```

### Krok 2: Utworzenie serwisu dla ocen

**Plik**: `src/lib/services/ratings.service.ts` (nowy)

- Utworzyć funkcję `upsertRating(supabase, userId, recipeId, rating)`:
  - Wykonać `upsert` na `recipe_ratings` z `user_id`, `recipe_id`, `rating`
  - Ustawić `updated_at = NOW()` przy aktualizacji
  - Zwrócić `RecipeRatingDTO`

- Utworzyć funkcję `deleteRating(supabase, userId, recipeId)`:
  - Usunąć rekord z `recipe_ratings` gdzie `user_id = userId` AND `recipe_id = recipeId`
  - Zwrócić `boolean` (true jeśli usunięto, false jeśli nie znaleziono)

- Dodać funkcję pomocniczą `mapDbError` (skopiować z `recipes.service.ts`)

### Krok 3: Utworzenie serwisu dla ulubionych

**Plik**: `src/lib/services/favorites.service.ts` (nowy)

- Utworzyć funkcję `setFavorite(supabase, userId, recipeId, favorite)`:
  - Jeśli `favorite === true`: wykonać `upsert` na `recipe_favorites`
  - Jeśli `favorite === false`: usunąć rekord z `recipe_favorites` (jeśli istnieje)
  - Zwrócić `RecipeFavoriteDTO`

- Dodać funkcję pomocniczą `mapDbError`

### Krok 4: Utworzenie endpointu PUT /api/recipes/[id]/rating

**Plik**: `src/pages/api/recipes/[id]/rating.ts` (nowy)

- Eksportować `export const prerender = false`
- Zaimplementować handler `PUT`:
  - Pobranie `id` z `params`
  - Pobranie użytkownika z `supabase.auth.getUser()`
  - Walidacja autoryzacji (401 jeśli brak użytkownika)
  - Parsowanie JSON z body
  - Walidacja za pomocą `putRecipeRatingCommandSchema`
  - Sprawdzenie istnienia przepisu przez `getRecipeById`
  - Wywołanie `upsertRating`
  - Zwrócenie odpowiedzi 200 z DTO

### Krok 5: Utworzenie endpointu DELETE /api/recipes/[id]/rating

**Plik**: `src/pages/api/recipes/[id]/rating.ts` (rozszerzenie)

- Zaimplementować handler `DELETE`:
  - Pobranie `id` z `params`
  - Pobranie użytkownika
  - Walidacja autoryzacji
  - Sprawdzenie istnienia przepisu
  - Wywołanie `deleteRating`
  - Zwrócenie odpowiedzi 204 lub 404 jeśli ocena nie istnieje

### Krok 6: Utworzenie endpointu PUT /api/recipes/[id]/favorite

**Plik**: `src/pages/api/recipes/[id]/favorite.ts` (nowy)

- Eksportować `export const prerender = false`
- Zaimplementować handler `PUT`:
  - Pobranie `id` z `params`
  - Pobranie użytkownika
  - Walidacja autoryzacji
  - Parsowanie JSON z body
  - Walidacja za pomocą `putRecipeFavoriteCommandSchema`
  - Sprawdzenie istnienia przepisu
  - Wywołanie `setFavorite`
  - Zwrócenie odpowiedzi 200 z DTO

### Krok 7: Testowanie

- Przetestować wszystkie scenariusze sukcesu
- Przetestować wszystkie scenariusze błędów (401, 404, 422, 500)
- Sprawdzić działanie RLS (użytkownik nie może modyfikować ocen/ulubionych innych użytkowników)
- Sprawdzić walidację zakresu ocen (1-5)
- Sprawdzić idempotencję operacji PUT

### Krok 8: Refaktoryzacja i optymalizacja

- Sprawdzenie linterów i poprawa błędów
- Optymalizacja zapytań jeśli potrzeba
- Dodanie dodatkowych testów jednostkowych jeśli wymagane

## 10. Uwagi implementacyjne

### 10.1 Użycie Supabase Client

- Zawsze używać `locals.supabase` z kontekstu Astro, nie importować `supabaseClient` bezpośrednio
- Typ: `SupabaseClient` z `src/db/supabase.client.ts`

### 10.2 Obsługa błędów

- Używać early returns dla warunków błędów
- Logować błędy za pomocą `console.error` z kontekstem
- Zwracać spójne struktury błędów zgodne z `ApiError`

### 10.3 Walidacja

- Walidować dane wejściowe na początku funkcji
- Używać `safeParse` z Zod dla bezpiecznej walidacji
- Zwracać `fieldErrors` w odpowiedziach błędów walidacji

### 10.4 Spójność z istniejącym kodem

- Zgodność ze strukturą istniejących endpointów (`recipes/[id].ts`)
- Użycie tych samych wzorców dla obsługi błędów
- Zgodność z konwencjami nazewnictwa projektu

