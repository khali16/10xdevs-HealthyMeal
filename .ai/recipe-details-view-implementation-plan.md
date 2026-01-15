## Plan implementacji widoku Szczegóły przepisu

## 1. Przegląd

Widok **Szczegóły przepisu** prezentuje pełne dane przepisu użytkownika (tytuł, tagi, czasy, kalorie, porcje, składniki, kroki) oraz zapewnia główne akcje: **ocena (1–5)**, **toggle „Ulubione”**, **skalowanie porcji (prezentacyjne, z „Nie skaluj” per składnik)** oraz wejście do akcji AI **„Dostosuj przepis”** (modal).

Wymagania UX i bezpieczeństwa:
- Optymistyczne UI dla oceny i ulubionych z rollbackiem po błędzie.
- 404 nie ujawnia, czy ID istnieje (RLS); fallback ma być neutralny.
- a11y: kontrolki oceny i ulubione jako elementy klikalne z ARIA i pełną obsługą klawiatury.

## 2. Routing widoku

- **Ścieżka**: `/recipes/[id]`
- **Plik Astro**: `src/pages/recipes/[id].astro` (nowy)
  - Pobiera `id` z `Astro.params.id`.
  - Renderuje layout i hydratuje komponent React `RecipeDetailsPage` przez `client:load`, analogicznie do listy (`src/pages/recipes/index.astro`).

## 3. Struktura komponentów

Główny komponent React: `src/components/recipes-details/RecipeDetailsPage.tsx` (nowy katalog dla tej funkcji; nie mieszamy z listą, żeby nie rozrastał się folder `src/components/recipes`).

Hierarchia (wysoki poziom):
- `RecipeDetailsPage`
  - `RecipeDetailsHeader`
    - `RecipeActionsMenu` (Edytuj / Usuń)
    - `RecipeTagsRow`
  - `RecipeInlineActions`
    - `RecipeRatingControl`
    - `RecipeFavoriteToggle`
    - `RecipeAdjustButton` → `RecipeAdjustModal`
  - `RecipeServingsScaler` (prezentacyjne)
    - `ServingsInput` / `Slider`
    - `NoScaleIngredientList` (local-only toggles)
  - `RecipeIngredientsSection`
  - `RecipeStepsSection`
  - `RecipeMetaSection` (czas/kalorie/porcje)
  - `RecipeDetailsSkeleton` / `RecipeDetailsErrorState` / `RecipeDetailsNotFoundState`

## 4. Szczegóły komponentów

### `RecipeDetailsPage`

- **Opis**: Kontener strony. Pobiera dane przepisu, mapuje DTO → ViewModel, utrzymuje stan widoku, obsługuje optymistyczne akcje (rating/favorite) i steruje modalem AI.
- **Główne elementy**:
  - `<section>` + wrapper z ograniczeniem szerokości (spójny z listą: `max-w-6xl`, paddingi).
  - Render warunkowy: skeleton / błąd / notFound / treść.
- **Obsługiwane interakcje**:
  - Wejście na stronę → `GET /api/recipes/{id}`
  - Zmiana oceny/wyczyszczenie oceny
  - Toggle ulubionych
  - Zmiana target porcji (lokalnie)
  - Otwórz modal „Dostosuj przepis”
  - Klik „Edytuj” → nawigacja do `/recipes/[id]/edit` (jeśli istnieje)
  - Klik „Usuń” → potwierdzenie → `DELETE /api/recipes/{id}` → po sukcesie redirect do `/recipes`
- **Warunki walidacji**:
  - `id` musi istnieć (guard na start; jeśli brak, traktuj jak 404/invalid route).
  - Rating: liczba całkowita 1–5 (frontend: blokada wysyłki poza zakresem; backend waliduje Zod).
  - Favorite: boolean (frontend wysyła wyłącznie `true|false`).
  - Skalowanie porcji: `baseServings > 0`; `targetServings` jako dodatnia liczba całkowita (min 1; max 10_000 zgodnie z kontraktami dla `servings` w PRD/validacji).
- **Typy**:
  - DTO: `RecipeDTO`, `RecipeRatingDTO`, `RecipeFavoriteDTO`, `ApiError`, `ApiSuccess<T>`
  - VM: `RecipeDetailsVM`, `RecipeDetailsViewState`, `ScaledIngredientVM`, `RecipeMetaVM`
- **Propsy**:
  - `recipeId: string` (z `[id].astro`)

### `RecipeDetailsHeader`

- **Opis**: Górna sekcja strony: tytuł, tagi (czas/kalorie/dieta/ocena), menu akcji.
- **Główne elementy**:
  - `<header>`
  - shadcn/ui: `Badge` dla tagów, `DropdownMenu` dla akcji.
- **Obsługiwane interakcje**:
  - `onEdit()`, `onDelete()`
- **Walidacja**: brak (prezentacyjne).
- **Typy**: `RecipeDetailsVM` (lub wycinek: `title`, `tags`, `meta`, `rating`).
- **Propsy**:
  - `title: string`
  - `tags: RecipeTagsVM`
  - `meta: RecipeMetaVM`
  - `rating: number | null`
  - `onEdit: () => void`
  - `onDelete: () => void`

### `RecipeActionsMenu`

- **Opis**: Dropdown z akcjami „Edytuj”, „Usuń”.
- **Główne elementy**:
  - shadcn/ui: `DropdownMenu`, `AlertDialog` (potwierdzenie usunięcia).
- **Obsługiwane interakcje**:
  - `onEdit`
  - `onConfirmDelete`
- **Walidacja**:
  - Delete wymaga potwierdzenia.
  - W trakcie usuwania: disable przycisków, spinner.
- **Typy**: `DeleteRecipeState` (np. `idle|pending|error`).
- **Propsy**:
  - `onEdit: () => void`
  - `onConfirmDelete: () => Promise<void>`
  - `isDeleting: boolean`

### `RecipeInlineActions`

- **Opis**: Pasek szybkich akcji: ocena, ulubione, AI „Dostosuj”.
- **Główne elementy**: kontener `<div>` z 3 elementami akcji.
- **Obsługiwane interakcje**: przekazuje eventy do rodzica.
- **Walidacja**: delegowana (rating/favorite).
- **Typy**: brak (kompozycja).
- **Propsy**:
  - `rating: number | null`
  - `isFavorite: boolean`
  - `onSetRating: (rating: number) => void`
  - `onClearRating: () => void`
  - `onToggleFavorite: (next: boolean) => void`
  - `onOpenAdjust: () => void`

### `RecipeRatingControl`

- **Opis**: Kontrolka oceny 1–5 z możliwością usunięcia oceny.
- **Główne elementy**:
  - Semantyka: najlepiej `role="radiogroup"` + 5 przycisków `role="radio"` (lub natywne `<input type="radio">` ukryte + label).
  - `aria-label`/`aria-describedby` (np. „Oceń przepis”).
- **Obsługiwane interakcje**:
  - Klik/Enter/Spacja na gwiazdce → `onChange(1..5)`
  - Opcjonalnie: przycisk „Usuń ocenę” → `onClear()`
- **Walidacja**:
  - Blokuj `onChange` dla wartości poza 1–5.
  - Podczas `isPending`: disable.
- **Typy**: `rating: number | null`.
- **Propsy**:
  - `value: number | null`
  - `isPending: boolean`
  - `onChange: (next: number) => void`
  - `onClear: () => void`

### `RecipeFavoriteToggle`

- **Opis**: Toggle ulubionych.
- **Główne elementy**: shadcn/ui `Switch` lub `Button` typu toggle.
- **Obsługiwane interakcje**: `onChange(next: boolean)`.
- **Walidacja**: brak (boolean).
- **Propsy**:
  - `checked: boolean`
  - `isPending: boolean`
  - `onChange: (next: boolean) => void`

### `RecipeAdjustButton` + `RecipeAdjustModal`

- **Opis**: Przycisk otwierający modal akcji AI „Dostosuj przepis”.
- **Główne elementy**:
  - shadcn/ui: `Button`, `Dialog`
  - W modalu: opis, parametry (np. checkboxy „avoid_allergens/use_exclusions”, target kalorii, presety), disclaimer.
- **Obsługiwane interakcje**:
  - `onOpenChange(open: boolean)`
  - `onSubmit(parameters)` (start job)
- **Walidacja (frontend)**:
  - Minimalnie: typy i zakresy pól (np. `target_calories >= 0`), zgodnie z API planem.
  - Soft gate, jeśli profil niekompletny (zgodnie z PRD) – jeśli w aplikacji istnieje sposób weryfikacji profilu (np. `GET /api/me`), modal ma pokazać ostrzeżenie, ale pozwolić kontynuować.
- **Typy**:
  - DTO: `StartAIAdjustmentCommand`, `StartAIAdjustmentResponse`, `AIAdjustmentJobDTO` (z `src/types.ts`)
  - VM: `RecipeAdjustFormVM` (lokalny model formularza)
- **Propsy**:
  - `recipeId: string`
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`

### `RecipeServingsScaler`

- **Opis**: Sekcja skalowania porcji i ilości składników — w tym MVP jako prezentacyjna (lokalna) warstwa nad danymi przepisu, bez zapisu do API.
- **Główne elementy**:
  - `Input`/`Slider` dla docelowej liczby porcji
  - Lista składników z opcją „Nie skaluj” per składnik (przełącznik; lokalnie wpływa na obliczenia)
  - Notka o zaokrągleniach / ostrzeżenie dla wypieków (z PRD)
- **Obsługiwane interakcje**:
  - `onTargetServingsChange(next)`
  - `onToggleNoScale(ingredientIndex|id, next)`
- **Walidacja**:
  - `targetServings` min 1, max 10_000
  - Guard przed dzieleniem przez 0 (`baseServings`)
- **Typy**:
  - `RecipeIngredientDTO` (źródło)
  - `ScaledIngredientVM` (wynik po przeskalowaniu i formatowaniu)
- **Propsy**:
  - `baseServings: number`
  - `ingredients: RecipeIngredientDTO[]`
  - `targetServings: number`
  - `noScaleOverrides: Record<string, boolean>` (lub `Record<number, boolean>` jeśli brak stabilnych kluczy)
  - `onTargetServingsChange: (next: number) => void`
  - `onNoScaleOverridesChange: (next: Record<string, boolean>) => void`

### `RecipeIngredientsSection`

- **Opis**: Lista składników (już po przeskalowaniu) oraz ewentualne oznaczenia `no_scale`.
- **Główne elementy**:
  - `<ul>`/`<ol>` z wierszami składników, `Separator` między sekcjami.
- **Interakcje**: brak (poza ewentualnym powiązaniem z togglami w scalerze).
- **Walidacja**: jeśli brak składników (nie powinno wg PRD dla poprawnego przepisu), pokaż fallback „Brak składników”.
- **Typy**: `ScaledIngredientVM[]`.
- **Propsy**:
  - `items: ScaledIngredientVM[]`

### `RecipeStepsSection`

- **Opis**: Kroki wykonania przepisu.
- **Główne elementy**: `<ol>` z numeracją.
- **Interakcje**: brak.
- **Walidacja**: jeśli brak kroków, fallback „Brak kroków”.
- **Typy**: `string[]`.
- **Propsy**:
  - `steps: string[]`

### `RecipeMetaSection`

- **Opis**: Metadane: czasy, kalorie, porcje.
- **Główne elementy**: `Card`/`Badge`/lista definicji (`<dl>`).
- **Interakcje**: brak.
- **Walidacja**:
  - Pola nullable wyświetlaj jako „—” (np. brak kalorii).
- **Typy**: `RecipeMetaVM`.
- **Propsy**:
  - `meta: RecipeMetaVM`

### `RecipeDetailsSkeleton` / `RecipeDetailsErrorState` / `RecipeDetailsNotFoundState`

- **Opis**: Wspierają loading, błąd i 404.
- **Główne elementy**:
  - shadcn/ui `Skeleton` dla loading
  - komunikaty + przycisk „Spróbuj ponownie” w error
  - neutralny komunikat w notFound (bez „ujawniania” istnienia ID)
- **Interakcje**:
  - `onRetry()`
- **Propsy**:
  - `message?: string`
  - `onRetry?: () => void`

## 5. Typy

### DTO używane bez zmian (źródło: `src/types.ts`)

- `RecipeDTO`
  - `id: UUID`
  - `title: string`
  - `ingredients: RecipeIngredientDTO[]`
  - `steps: string[]`
  - `tags: RecipeTags` (`Record<string, string>`)
  - `prep_time_minutes: number | null`
  - `cook_time_minutes: number | null`
  - `total_time_minutes: number | null`
  - `calories_per_serving: number | null`
  - `servings: number`
  - `rating?: number | null` (computed, user-specific)
  - `is_favorite?: boolean` (computed, user-specific)
- `RecipeIngredientDTO`
  - `text: string`
  - `unit?: string`
  - `amount?: number`
  - `no_scale?: boolean`
- `PutRecipeRatingCommand` → `{ rating: number }`
- `RecipeRatingDTO` → `{ recipe_id: UUID; rating: number }`
- `PutRecipeFavoriteCommand` → `{ favorite: boolean }`
- `RecipeFavoriteDTO` → `{ recipe_id: UUID; favorite: boolean }`
- `ApiError`, `ApiSuccess<T>`

### Nowe typy ViewModel (proponowane do dodania w `src/components/recipes-details/types.ts`)

- `RecipeDetailsViewState`
  - `status: 'loading' | 'ready' | 'error' | 'not_found'`
  - `data?: RecipeDetailsVM`
  - `error?: { code?: string; message: string }`
- `RecipeDetailsVM`
  - `id: string`
  - `title: string`
  - `tags: RecipeTagsVM`
  - `ingredients: RecipeIngredientDTO[]` (surowe, do przeskalowania)
  - `steps: string[]`
  - `meta: RecipeMetaVM`
  - `rating: number | null`
  - `isFavorite: boolean`
  - `isAiAdjusted?: boolean` (jeśli obecne w `RecipeRow`; jeśli nie, wyłączamy UI statusu)
  - `originalRecipeId?: string | null` (jw.)
- `RecipeTagsVM`
  - `diet?: string | null` (np. `tags['diet']`)
  - `other: Array<{ key: string; value: string }>` (pozostałe tagi do badge)
- `RecipeMetaVM`
  - `prepTimeMinutes: number | null`
  - `cookTimeMinutes: number | null`
  - `totalTimeMinutes: number | null`
  - `caloriesPerServing: number | null`
  - `baseServings: number`
- `ScaledIngredientVM`
  - `key: string` (stabilny klucz do listy; np. `${index}:${text}`)
  - `text: string`
  - `amountRaw?: number`
  - `amountScaled?: number`
  - `amountDisplay?: string` (po zaokrągleniu/fraction)
  - `unit?: string`
  - `noScale: boolean`

### Mapper DTO → VM (nowy plik `src/components/recipes-details/mappers.ts`)

- `mapRecipeDtoToDetailsVM(dto: RecipeDTO): RecipeDetailsVM`
  - ustawia `rating = dto.rating ?? null`, `isFavorite = dto.is_favorite ?? false`
  - mapuje `tags` do `RecipeTagsVM`
  - mapuje pola meta do `RecipeMetaVM`

## 6. Zarządzanie stanem

### Stan w `RecipeDetailsPage`

- **Stan danych widoku**: `RecipeDetailsViewState`
  - `loading` na start i przy retry
  - `not_found` przy 404
  - `error` przy błędach sieci/5xx
- **Stany akcji (UI)**:
  - `ratingPending: boolean` (lub `pendingAction: 'rating' | 'favorite' | 'delete' | null`)
  - `favoritePending: boolean`
  - `deletePending: boolean`
  - `adjustModalOpen: boolean`
- **Stan skalowania porcji (lokalny)**:
  - `targetServings: number` (domyślnie `baseServings`)
  - `noScaleOverrides: Record<string, boolean>` (lokalne nadpisania `ingredient.no_scale`)
- **Hooki (zalecane)**
  - `useAbortableFetch()` (reuse z listy: `src/components/recipes/hooks/useAbortableFetch.ts`)
  - Nowy hook `useRecipeDetails(recipeId)` (opcjonalnie), który:
    - pobiera dane `GET /api/recipes/{id}`
    - zwraca `state`, `retry`
  - Nowy hook `useRecipeActions(recipeId)` (opcjonalnie), który:
    - wystawia metody `setRating`, `clearRating`, `setFavorite`, `deleteRecipe`
    - implementuje optymistyczne aktualizacje z rollbackiem.

## 7. Integracja API

### Kontrakty (zgodne z `api-plan` i aktualnymi endpointami w repo)

- **GET `/api/recipes/{id}`**
  - Response 200: `{ data: RecipeDTO }`
  - Errors: 404, 401 (w repo: 404/500; 401 docelowo)
- **PUT `/api/recipes/{id}/rating`**
  - Request: `PutRecipeRatingCommand` (`{ rating: 1..5 }`)
  - Response 200: `{ data: RecipeRatingDTO }`
  - Errors: 422 (validation), 404, 401
- **DELETE `/api/recipes/{id}/rating`**
  - Response 204
  - Errors: 404, 401
- **PUT `/api/recipes/{id}/favorite`**
  - Request: `PutRecipeFavoriteCommand` (`{ favorite: boolean }`)
  - Response 200: `{ data: RecipeFavoriteDTO }`
  - Errors: 404, 401
- **DELETE `/api/recipes/{id}`**
  - Response 204 (soft delete)
  - Errors: 404, 401
  - Uwaga: w repo endpoint `DELETE /api/recipes/{id}` nie jest jeszcze zaimplementowany w `src/pages/api/recipes/[id].ts` — frontendowy plan zakłada jego dostępność (blokująca zależność dla akcji „Usuń”).

### Warstwa frontendu (proponowane funkcje w `src/lib/api/recipes.ts`)

Rozszerzyć `src/lib/api/recipes.ts` (jest już `listRecipes`) o:
- `getRecipeById(id: string, signal?: AbortSignal): Promise<{ data: RecipeDTO }>`
- `putRecipeRating(id: string, cmd: PutRecipeRatingCommand): Promise<{ data: RecipeRatingDTO }>`
- `deleteRecipeRating(id: string): Promise<void>` (sprawdza `res.ok` dla 204)
- `putRecipeFavorite(id: string, cmd: PutRecipeFavoriteCommand): Promise<{ data: RecipeFavoriteDTO }>`
- `deleteRecipe(id: string): Promise<void>`

Wszystkie metody:
- Parsują JSON na błędach (`ApiError`) i mapują do `{ code, message }` analogicznie do `listRecipes`.
- Dla 204: nie parsują body.
- Ustawiają nagłówki `Accept: application/json`, a dla PUT także `Content-Type: application/json`.

## 8. Interakcje użytkownika

- **Wejście na `/recipes/[id]`**
  - Pokazuj skeleton, pobierz dane.
  - Po sukcesie renderuj treść.
  - Po 404 renderuj neutralny `NotFoundState` (np. „Nie udało się otworzyć przepisu.” + link do listy).
- **Ocena (1–5)**
  - Klik na gwiazdce ustawia ocenę optymistycznie.
  - Wywołuje `PUT /rating`.
  - Po błędzie rollback do poprzedniej wartości + toast/alert.
- **Usuń ocenę**
  - Przycisk „Usuń ocenę” (albo UX: ponowne kliknięcie tej samej oceny) → optymistycznie ustaw `null`, `DELETE /rating`, rollback po błędzie.
- **Ulubione**
  - Toggle optymistycznie przełącza `isFavorite`.
  - Wywołuje `PUT /favorite` z `{ favorite: next }`.
  - Rollback po błędzie.
- **Skalowanie porcji**
  - Zmiana `targetServings` przelicza ilości składników w UI (bez API).
  - „Nie skaluj” per składnik (local-only) wyłącza przeliczenie dla składnika.
  - Reguły zaokrągleń (PRD):
    - g/ml → do 1 (integer)
    - łyżeczki → do 0,25 oraz wyświetlanie ułamków 1/2, 1/3 (formatowanie w VM)
- **Edytuj**
  - `DropdownMenuItem` → nawigacja do `/recipes/[id]/edit` (jeśli widok edycji istnieje; jeśli nie, w MVP można ukryć opcję).
- **Usuń**
  - `AlertDialog` z potwierdzeniem.
  - `DELETE /api/recipes/{id}` → po 204 redirect do `/recipes`.
  - Jeśli endpoint niedostępny: pokaż komunikat „Funkcja w przygotowaniu” (do czasu implementacji backendu).
- **AI „Dostosuj”**
  - Przycisk otwiera modal.
  - W modalu: ustaw parametry, pokaż disclaimer, uruchom akcję AI (osobna integracja z jobami wg `api-plan`).

## 9. Warunki i walidacja

### Warunki weryfikowane po stronie UI (guardy + blokady akcji)

- **ID przepisu**:
  - Jeśli `recipeId` pusty/undefined → nie wykonuj fetch, pokaż stan `not_found`.
- **Rating**:
  - Wysyłaj tylko `int` 1–5.
  - Przy kliknięciu/klawiaturze poza zakresem: ignoruj.
  - Podczas `ratingPending`: blokuj kolejne zmiany (lub kolejkuj ostatnią).
- **Favorite**:
  - Wysyłaj tylko boolean.
  - Podczas `favoritePending`: blokuj toggle.
- **Skalowanie porcji**:
  - `targetServings` clamp do [1..10_000].
  - Jeśli `baseServings <= 0`: wyłącz skalowanie i pokaż ostrzeżenie (edge case).
- **Usuwanie**:
  - Wymagane potwierdzenie.
  - W trakcie `deletePending`: disable dialog actions.

### Warunki wynikające z API (i jak je odzwierciedlić w UI)

- `PUT /rating` może zwrócić 422 (VALIDATION_ERROR):
  - pokaż komunikat walidacji (np. „Ocena musi być w zakresie 1–5”) i rollback.
- 404 dla `GET`/`PUT`/`DELETE`:
  - `GET`: przełącz stan widoku na `not_found`.
  - `PUT/DELETE`: pokaż toast „Przepis niedostępny” i rollback.
- 401:
  - docelowo przekierowanie do logowania lub pokazanie „Sesja wygasła” (zależnie od istniejącej obsługi auth w appce).

## 10. Obsługa błędów

- **Błędy sieci / 5xx**:
  - Stan `error` z krótkim komunikatem i przyciskiem „Spróbuj ponownie”.
  - Logowanie do `console.error` (spójnie z istniejącymi endpointami).
- **404 na wejściu**:
  - Neutralny `NotFoundState` + link do `/recipes`.
- **Rollback optymistyczny**:
  - Dla `rating` i `favorite` przechowuj poprzednią wartość i przy błędzie natychmiast ją przywróć.
- **Brak implementacji `DELETE /api/recipes/{id}` w repo**:
  - UI ma mieć wyraźny fallback, dopóki endpoint nie powstanie (zależność między zespołami).

## 11. Kroki implementacji

1. Utwórz stronę routingu `src/pages/recipes/[id].astro` i podepnij `Layout`, analogicznie do `src/pages/recipes/index.astro`. Przekaż `recipeId` do komponentu React.
2. Dodaj nowy katalog `src/components/recipes-details/` oraz pliki: `RecipeDetailsPage.tsx`, `types.ts`, `mappers.ts`, `components/*` (header/actions/sections/states).
3. Zaimplementuj `RecipeDetailsViewState` oraz skeleton/error/notFound komponenty; upewnij się, że fallback 404 jest neutralny.
4. Rozszerz `src/lib/api/recipes.ts` o metody: `getRecipeById`, `putRecipeRating`, `deleteRecipeRating`, `putRecipeFavorite`, `deleteRecipe` (plus mapowanie błędów jak w `listRecipes`).
5. W `RecipeDetailsPage` zaimplementuj pobieranie danych z `useAbortableFetch` i renderowanie widoku wg `status`.
6. Dodaj kontrolkę oceny z a11y (radiogroup) oraz optymistyczną aktualizację + rollback dla `PUT/DELETE /rating`.
7. Dodaj toggle ulubionych z optymistyczną aktualizacją + rollback dla `PUT /favorite`.
8. Dodaj sekcję skalowania porcji (lokalnie): stan `targetServings`, `noScaleOverrides`, funkcje przeliczeń i formatowania ilości (zgodnie z regułami zaokrągleń z PRD).
9. Dodaj menu akcji „Edytuj/Usuń”:
   - „Edytuj” jako link do `/recipes/[id]/edit` (lub ukryj, jeśli widok nie istnieje).
   - „Usuń” z `AlertDialog` + wywołanie `DELETE /api/recipes/{id}`; jeśli endpoint nie jest dostępny, dodaj tymczasowy fallback komunikatu.
10. Dodaj przycisk „Dostosuj przepis” i modal (min. otwieranie/zamykanie). Integrację z jobami AI wdrażaj w kolejnych krokach zgodnie z `api-plan` (start job + polling statusów).
11. Zadbaj o spójny styl Tailwind + shadcn/ui oraz o focus states/klawiaturę dla rating/favorite/menu.


