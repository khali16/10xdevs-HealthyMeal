## Plan implementacji widoku Lista przepisów

## 1. Przegląd

Widok **Lista przepisów** pozwala użytkownikowi szybko przeglądać własne przepisy w formie kart, z **sortowaniem, filtrami, wyszukiwaniem i paginacją**. Widok wspiera stany: loading (skeletony), empty, error. Filtry i sort są synchronizowane z URL query (shareable + back/forward).

Kluczowy cel MVP wg PRD:
- **Prywatna lista przepisów użytkownika** z sortowaniem: `newest` (domyślne), `favorites`, `top_rated`.
- **Oznaczanie ulubionych** i **prywatna ocena** (1–5) mają wpływać na sortowanie i widoczność.

## 2. Routing widoku

- **Ścieżka**: `/recipes`
- **Plik strony**: `src/pages/recipes/index.astro` (nowy)
- **Layout**: `src/layouts/Layout.astro`

Uwagi:
- W aplikacji nie ma jeszcze gotowego routingu/nawigacji — w MVP widok może być dostępny przez bezpośredni URL oraz link dodany później w headerze/layoutcie.

## 3. Struktura komponentów

Proponowana implementacja: strona Astro renderuje shell (layout + nagłówek), a interaktywną część realizuje React.

**Wysokopoziomowe drzewo komponentów**:

- `src/pages/recipes/index.astro`
  - `Layout`
    - `<main>`
      - `RecipesListPage` (React, `client:load`)
        - `RecipesListHeader`
          - `SortSelect`
          - `NewRecipeButton`
        - `RecipesFiltersBar`
          - `SearchInput` (debounce)
          - `DietSelect`
          - `MaxCaloriesInput`
          - `MaxTotalTimeInput`
          - `FavoritesOnlySwitch`
        - `RecipesActiveFiltersChips` (opcjonalnie)
        - `RecipesGrid`
          - `RecipeCard` (xN)
            - `FavoriteToggle` (opcjonalnie: natychmiastowe akcje)
            - `RatingIndicator` (opcjonalnie)
        - `RecipesPagination`
          - `PaginationControls` lub `LoadMoreButton` (w zależności od UX)
        - `RecipesEmptyState` / `RecipesErrorState`

## 4. Szczegóły komponentów

### `src/pages/recipes/index.astro`

- **Opis**: Definiuje routing `/recipes`, osadza layout i mountuje Reactowy widok listy.
- **Główne elementy**:
  - `<Layout title="Przepisy">`
  - `<main class="...">`
  - `RecipesListPage` z `client:load` (lub `client:visible` jeśli preferujemy lazy mount).
- **Zdarzenia**: brak (komponent statyczny).
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**: brak.

### `RecipesListPage` (React)

- **Opis**: Kontener widoku. Odpowiada za:
  - parsowanie i walidację query z URL,
  - budowę zapytania do API,
  - fetch danych + obsługę stanów,
  - synchronizację UI ↔ URL.
- **Główne elementy**:
  - wrapper (`div`/`section`) + regiony: header/filters/grid/pagination
  - shadcn: `Card`, `Select`, `Input`, `Switch`, `Button`, `Skeleton`, `Alert`
- **Obsługiwane zdarzenia**:
  - `onSortChange(sort)`
  - `onFiltersChange(partialFilters)`
  - `onPageChange(page)` / `onLoadMore()`
  - `onRetry()`
- **Walidacja (frontend, przed call do API)**:
  - `page`: int, `>= 1`
  - `page_size`: int, `>= 1`, `<= 100` (zgodnie z backendowym limitem)
  - `diet`: string (trim, max długość np. 50)
  - `max_calories`: int, `>= 0`, sensowny limit UI (np. `<= 100000`)
  - `max_total_time`: int, `>= 0`, limit UI (np. `<= 2000`)
  - `favorite`: boolean
  - `q`: string trim, min 0, max np. 200 (debounce + ograniczenie)
  - `sort`: `'newest' | 'favorites' | 'top_rated'`
  - `tag:*`: **na start nie eksponujemy UI**, ale parser powinien tolerować nieznane klucze i zachować je w URL (opcjonalnie).
- **Typy**:
  - DTO: `RecipeDTO` (z `src/types.ts`)
  - Envelopes: `ApiListMeta`, `ApiError`
  - ViewModel: `RecipeCardVM`, `RecipesListViewState`, `RecipesListQuery`
- **Propsy**: brak (top-level view).

### `RecipesListHeader`

- **Opis**: Nagłówek listy: tytuł, sortowanie oraz CTA „Nowy przepis”.
- **Główne elementy**:
  - `<header>` + `h1`
  - `SortSelect` (shadcn `Select`)
  - `Button` „Nowy przepis”
- **Obsługiwane zdarzenia**:
  - `onSortChange(sort)`
  - `onCreateNew()` → nawigacja do planowanej ścieżki tworzenia (np. `/recipes/new`) lub placeholder (jeśli jeszcze nie istnieje).
- **Walidacja**:
  - sort musi być jednym z dozwolonych enumów.
- **Typy**:
  - `RecipeSort`
- **Propsy**:
  - `sort: RecipeSort`
  - `onSortChange: (sort: RecipeSort) => void`
  - `onCreateNew: () => void`

### `RecipesFiltersBar`

- **Opis**: Pasek filtrów, kontrolki formularza z etykietami i a11y.
- **Główne elementy**:
  - `<form role="search" aria-label="Filtry przepisów">` (lub `<section>`)
  - `Input` (q)
  - `Select` (diet)
  - `Input type="number"` (max_calories, max_total_time)
  - `Switch` (favorite)
  - `Button` „Wyczyść” (opcjonalnie)
- **Obsługiwane zdarzenia**:
  - `onQueryChange(q)` (debounced)
  - `onDietChange(diet)`
  - `onMaxCaloriesChange(value)`
  - `onMaxTotalTimeChange(value)`
  - `onFavoriteOnlyChange(bool)`
  - `onClear()`
- **Walidacja**:
  - liczby: parsowanie do int, ignorowanie `NaN`, clamp do zakresu; puste pole = brak filtra
  - `q`: trim, max długość
- **Typy**:
  - `RecipesListFiltersVM`
- **Propsy**:
  - `filters: RecipesListFiltersVM`
  - `onChange: (next: Partial<RecipesListFiltersVM>) => void`
  - `onClear?: () => void`

### `RecipesGrid`

- **Opis**: Prezentuje listę jako responsywny grid kart.
- **Główne elementy**:
  - `<section aria-label="Lista przepisów">`
  - `<ul role="list">` + elementy `<li>`
  - `RecipeCard`
- **Obsługiwane zdarzenia**:
  - `onOpenRecipe(id)` (klik w kartę/tytuł) → nawigacja do `/recipes/{id}` (jeśli istnieje) lub fallback (na start może prowadzić do API detail lub placeholder).
  - `onToggleFavorite(id, next)` (opcjonalnie)
  - `onRate(id, rating)` (opcjonalnie)
- **Walidacja**: brak (prezentacja).
- **Typy**:
  - `RecipeCardVM[]`
- **Propsy**:
  - `items: RecipeCardVM[]`
  - `onOpenRecipe?: (id: string) => void`
  - `onToggleFavorite?: (id: string, next: boolean) => void`
  - `onRate?: (id: string, rating: number | null) => void`

### `RecipeCard`

- **Opis**: Karta pojedynczego przepisu.
- **Główne elementy** (propozycja, zgodna z UI-plan + PRD):
  - tytuł (link/klik)
  - tagi (np. dieta, czas, kalorie)
  - meta: `rating` (jeśli jest), `is_favorite` (ikonka)
  - opcjonalnie: skrót składników (np. 1–2 pierwsze pozycje)
- **Obsługiwane zdarzenia**:
  - `onOpen()`
  - `onToggleFavorite(next)` (opcjonalnie)
  - `onRate(nextRating)` (opcjonalnie)
- **Walidacja**:
  - przy `onRate`: rating musi być `1..5` lub `null` (jeśli wspieramy reset).
- **Typy**:
  - `RecipeCardVM`
- **Propsy**:
  - `item: RecipeCardVM`
  - `onOpen?: () => void`
  - `onToggleFavorite?: (next: boolean) => void`
  - `onRate?: (next: number | null) => void`

### `RecipesPagination`

- **Opis**: Sterowanie paginacją (klasyczne page controls) albo „Wczytaj więcej”.
- **Główne elementy**:
  - informacja „X–Y z Z” (opcjonalnie)
  - `Button` prev/next lub `Load more`
- **Obsługiwane zdarzenia**:
  - `onPageChange(page)`
  - `onLoadMore()`
- **Walidacja**:
  - nie pozwala zejść poniżej 1 ani wejść w stronę bez `has_next`.
- **Typy**:
  - `ApiListMeta`
- **Propsy**:
  - `meta: ApiListMeta`
  - `isLoading?: boolean`
  - `onPageChange: (page: number) => void`

### `RecipesEmptyState` / `RecipesErrorState`

- **Opis**: Spójne stany pusty/błąd.
- **Główne elementy**:
  - `Alert` + opis
  - CTA: „Dodaj pierwszy przepis” (empty), „Spróbuj ponownie” (error)
- **Obsługiwane zdarzenia**:
  - `onCreateNew()`
  - `onRetry()`
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**:
  - `onRetry?: () => void`
  - `onCreateNew?: () => void`
  - `errorMessage?: string`

## 5. Typy

Poniższe typy są wymagane do implementacji widoku (część już istnieje w `src/types.ts`).

### Istniejące DTO / envelope

- **`RecipeDTO`** (`src/types.ts`)
  - źródło danych dla listy (w tym pola użytkownika: `rating?: number | null`, `is_favorite?: boolean`).
- **`ApiListMeta`** (`src/types.ts`)
  - `{ page, page_size, total?, has_next }`
- **`ApiError`** (`src/types.ts`)
  - `{ error: { code, message, details?, fieldErrors? } }`

### Nowe typy (ViewModel / UI)

#### `type RecipeSort = 'newest' | 'favorites' | 'top_rated'`

- Mapuje UI select sortowania.
- Wysyłane jako `sort` w query (wg API-plan).

#### `type RecipesListFiltersVM`

```ts
type RecipesListFiltersVM = {
  q: string
  diet: string | null
  max_calories: number | null
  max_total_time: number | null
  favorite: boolean
}
```

Uwagi:
- `diet` może pochodzić z `tags.diet` w `RecipeDTO`, ale filtr jest po stronie API.

#### `type RecipesListQuery`

```ts
type RecipesListQuery = {
  page: number
  page_size: number
  sort: RecipeSort
  // filtry
  q?: string
  diet?: string
  max_calories?: number
  max_total_time?: number
  favorite?: boolean
  // rozszerzenia:
  tags?: Record<string, string> // dla `tag:*`
}
```

#### `type RecipeCardVM`

```ts
type RecipeCardVM = {
  id: string
  title: string
  dietLabel?: string | null
  totalTimeMinutes?: number | null
  caloriesPerServing?: number | null
  rating?: number | null
  isFavorite?: boolean
  updatedAt?: string
}
```

Mapowanie z `RecipeDTO`:
- `dietLabel` = `dto.tags?.diet` (jeśli istnieje)
- `totalTimeMinutes` = `dto.total_time_minutes` (fallback: `prep + cook` jeśli backend kiedyś nie uzupełnia)
- `caloriesPerServing` = `dto.calories_per_serving`
- `rating`, `isFavorite` bezpośrednio z DTO.

#### `type RecipesListViewState`

```ts
type RecipesListViewState =
  | { status: 'loading'; items: RecipeCardVM[]; meta?: undefined; error?: undefined }
  | { status: 'ready'; items: RecipeCardVM[]; meta: import('@/types').ApiListMeta; error?: undefined }
  | { status: 'empty'; items: []; meta: import('@/types').ApiListMeta; error?: undefined }
  | { status: 'error'; items: RecipeCardVM[]; meta?: import('@/types').ApiListMeta; error: { code?: string; message: string } }
```

## 6. Zarządzanie stanem

Widok jest w pełni klientowy, więc stan trzymamy w React:

- **Stan query** (źródło prawdy = URL):
  - `query: RecipesListQuery`
  - aktualizacja poprzez `history.pushState/replaceState`
  - zmiana filtrów/sortu resetuje `page=1`
- **Stan danych**:
  - `state: RecipesListViewState`
- **Stan UI pomocniczy**:
  - `isFetching: boolean` (dla disable przycisków, skeletonów)
  - `debouncedQ: string` (dla wyszukiwania)

### Proponowane custom hooki

#### `useRecipesListQueryState()`

- **Cel**: parsowanie `window.location.search` → `RecipesListQuery` + funkcje `setQuery(partial, { replace?: boolean })`.
- **Zachowanie**:
  - clamp/normalizacja wartości (patrz walidacja w sekcji 4)
  - utrzymanie spójności URL (usuwanie pustych parametrów)
  - wspiera back/forward (`popstate`)

#### `useDebouncedValue(value, delayMs)`

- **Cel**: debounce `q` (~500 ms wg UI-plan) i dopiero wtedy update query / fetch.

#### `useAbortableFetch()`

- **Cel**: przy zmianie query anuluje poprzednie zapytanie `fetch` przez `AbortController` (eliminuje race conditions).

## 7. Integracja API

### Endpoint

- **Metoda/URL**: `GET /api/recipes`
- **Query (wg API-plan)**:
  - `page`, `page_size`
  - opcjonalnie: `diet`, `max_calories`, `max_total_time`, `favorite`, `q`, `sort`, `tag:*`

### Rzeczywista implementacja backendu (aktualny stan repo)

W `src/pages/api/recipes/index.ts` aktualnie parsowane są tylko:
- `page` (domyślnie 1)
- `page_size` (domyślnie 20, max 100)

**Plan frontendowy powinien:**
- już teraz budować query zgodne z API-plan (żeby UI było gotowe),
- tolerować fakt, że backend może ignorować część parametrów do czasu rozszerzenia endpointu.

### Typy request/response

- **Request**: brak body, query string.
- **Response 200**:
  - `ApiListSuccess<RecipeDTO>` w konwencji repo: `{ data: RecipeDTO[]; meta: ApiListMeta }`
- **Response błędu**:
  - `ApiError` (np. `401`, `429`, `500`)

### Warstwa fetch (propozycja modułu)

Utworzyć w `src/lib` mały klient:
- `src/lib/api/recipes.ts`
  - `listRecipes(query: RecipesListQuery, signal?: AbortSignal): Promise<{ data: RecipeDTO[]; meta: ApiListMeta }>`
  - wewnętrznie: `fetch('/api/recipes?...')`, `Content-Type: application/json`
  - parse JSON + mapowanie błędów do prostego shape `{ code, message }`
  - opcjonalnie: walidacja runtime z Zod (rekomendowane dla stabilności)

## 8. Interakcje użytkownika

- **Zmiana sortowania** (`newest`/`favorites`/`top_rated`):
  - aktualizacja `sort` w URL
  - reset `page=1`
  - refetch
- **Wyszukiwanie (`q`)**:
  - wpisywanie aktualizuje lokalny stan input
  - po ~500 ms bez zmian → update `q` w URL i refetch
- **Filtry liczbowo-selekcyjne** (`diet`, `max_calories`, `max_total_time`, `favorite`) :
  - zmiana kontrolki → update URL → reset page → refetch
- **Paginacja**:
  - `next/prev` lub `Load more`
  - update `page` w URL → refetch
- **Klik w kartę**:
  - nawigacja do `/recipes/{id}` (jeżeli widok szczegółu istnieje) lub zaplanowane do wdrożenia
- **Toggle ulubione (opcjonalnie na liście)**:
  - optimistic update w `items`
  - `PUT /api/recipes/{id}/favorite` z `{ favorite: boolean }`
  - rollback na błąd + toast/alert
- **Ocena (opcjonalnie na liście)**:
  - `PUT /api/recipes/{id}/rating` z `{ rating: 1..5 }` albo `DELETE` dla resetu (jeśli wspieramy)

## 9. Warunki i walidacja

### Walidacja query (UI → URL → API)

Walidacja w `useRecipesListQueryState()` oraz w kontrolkach:
- **`page`**:
  - jeśli brak/niepoprawny → `1`
  - minimalnie `1`
- **`page_size`**:
  - default `20`
  - clamp do `1..100`
- **`sort`**:
  - jeśli brak/nieznany → `'newest'`
- **`diet`**:
  - pusty string → usunięcie parametru
  - w UI ograniczyć do zdefiniowanych opcji (jeśli mamy słownik), inaczej free-text z limitem długości
- **`max_calories`, `max_total_time`**:
  - puste → brak filtra
  - `NaN` → brak filtra
  - `>= 0`
- **`favorite`**:
  - akceptuj `true/false/1/0` w URL; w UI zawsze boolean
- **`q`**:
  - trim
  - max długość (np. 200) i debounce

### Wpływ walidacji na UI

- Nieprawidłowe wartości w URL nie powinny psuć widoku — są normalizowane i (opcjonalnie) zapisywane z powrotem do URL przez `replaceState`.
- Przy wartościach out-of-range: UI pokazuje skorygowaną wartość.

## 10. Obsługa błędów

Scenariusze i zachowanie:

- **401 UNAUTHORIZED**:
  - pokaż komunikat „Zaloguj się, aby zobaczyć przepisy”
  - CTA do ekranu logowania (jeśli istnieje) lub placeholder
- **429 RATE_LIMIT** (middleware):
  - pokaż komunikat „Za dużo żądań, spróbuj ponownie za chwilę”
  - automatyczny retry po krótkim opóźnieniu tylko po kliknięciu „Ponów” (bez pętli)
- **5xx / network error**:
  - stan error + przycisk „Ponów”
  - zachowaj poprzednie dane na ekranie (jeśli były) i pokaż banner błędu (lepszy UX)
- **Błędy parsowania JSON / nieoczekiwany shape**:
  - traktuj jak `INTERNAL` po stronie UI, loguj do `console.error`
  - (opcjonalnie) w przyszłości: wysyłka do analityki/logów

## 11. Kroki implementacji

1. **Dodać routing Astro**: utworzyć `src/pages/recipes/index.astro`, osadzić `Layout` i placeholder `<main>`.
2. **Dodać React view**: utworzyć `src/components/recipes/RecipesListPage.tsx` i podpiąć w `index.astro` przez `client:load`.
3. **Zaimplementować typy ViewModel**: dodać nowe typy (np. w `src/types.ts` lub dedykowanym `src/components/recipes/types.ts` — preferowane, aby nie mieszać z shared DTO).
4. **Zaimplementować `useRecipesListQueryState()`**: parse/serialize query, obsługa `popstate`, normalizacja parametrów.
5. **Zaimplementować warstwę API**: `src/lib/api/recipes.ts` z funkcją `listRecipes(query, signal)` budującą query string i mapującą odpowiedzi do `{ data, meta }` / błąd.
6. **Zbudować UI headera**: `RecipesListHeader` + select sort + CTA „Nowy przepis”.
7. **Zbudować UI filtrów**: `RecipesFiltersBar` (z debounce dla `q`) + reset `page=1` przy zmianach.
8. **Zbudować grid kart**: `RecipesGrid` + `RecipeCard` (responsywny layout, skeletony, a11y).
9. **Dodać paginację**: `RecipesPagination` (prev/next lub load more), bazując na `meta.has_next` i `meta.page`.
10. **Dodać stany empty/error**: czytelne komunikaty, CTA, `aria-live` dla błędów.
11. **(Opcjonalnie, zgodnie z PRD)**: dodać akcje na liście:
  - toggle ulubionych (PUT `/api/recipes/{id}/favorite`) z optimistic update,
  - rating (PUT `/api/recipes/{id}/rating`) jeśli UX tego wymaga na liście.
12. **Testy manualne**:
  - back/forward w przeglądarce przy zmianach filtrów,
  - debounce search,
  - zachowanie na slow network (skeleton + abort poprzednich requestów),
  - empty state (brak wyników),
  - error state (symulacja 500/429).


