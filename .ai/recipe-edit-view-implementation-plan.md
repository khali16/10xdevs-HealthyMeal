## Plan implementacji widoku Edycja przepisu

## 1. Przegląd
Widok „Edycja przepisu” pozwala użytkownikowi zmienić zapisany przepis i **zapisać zmiany przez `PATCH /api/recipes/{id}`**, co aktualizuje `updated_at` i wpływa na sortowanie listy (US‑024). Widok musi zapewnić:

- edycję pól przepisu (tytuł, składniki, kroki, tagi, czasy, porcje, kalorie),
- stan „dirty” oraz ochronę przed utratą zmian (dialog + `beforeunload`),
- spójne walidacje (lokalne + obsługa błędów 422/400 z `fieldErrors`),
- obsługę stanów: loading / not found / error / ready.

## 2. Routing widoku
- **Ścieżka**: `/recipes/[id]/edit`
- **Strona Astro**: dodać `src/pages/recipes/[id]/edit.astro`
  - pobrać `id` z `Astro.params`
  - wyrenderować React komponent strony edycji: `<RecipeEditPage recipeId={id ?? ''} client:load />`
  - użyć istniejącego layoutu `src/layouts/Layout.astro` (spójnie z `/recipes`, `/recipes/new`, `/recipes/[id]`)

## 3. Struktura komponentów
Wariant rekomendowany (max re-use istniejących edytorów z `recipe-create`):

- `RecipeEditPage` (container: fetch + stan widoku)
  - `RecipeEditHeader`
    - (opcjonalnie) `RecipePrivacyNotice` (re-use z `recipe-create`)
  - `RecipeEditForm`
    - `RecipeTitleField` (re-use)
    - `RecipeIngredientsEditor` (re-use)
      - `RecipeIngredientRow` (re-use)
    - `RecipeStepsEditor` (re-use)
      - `RecipeStepRow` (re-use)
    - `RecipeMetaEditor` (re-use)
  - `RecipeEditFooterActions` (CTA: Zapisz / Anuluj)
  - `UnsavedChangesAlertDialog` (Shadcn `AlertDialog`)
  - `InlineErrorAlert` (Shadcn `Alert` dla błędów zapisu/akcji)

## 4. Szczegóły komponentów

### `src/pages/recipes/[id]/edit.astro`
- **Opis**: Router + osadzenie React widoku.
- **Główne elementy**: `Layout`, `main`, `RecipeEditPage`.
- **Obsługiwane zdarzenia**: brak (statyczna strona Astro).
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**: przekazuje `recipeId: string` do `RecipeEditPage`.

### `RecipeEditPage`
- **Opis**: Główny kontener. Ładuje dane przepisu (`GET /api/recipes/{id}`), mapuje do stanu formularza, zarządza zapisem (`PATCH /api/recipes/{id}`), obsługuje „dirty guard” i stany loading/error.
- **Główne elementy**:
  - wrapper `section` + layout jak w `RecipeDetailsPage` (`mx-auto max-w-6xl px-4 py-8 ...`)
  - w zależności od stanu: skeleton / not-found / error / formularz
- **Obsługiwane zdarzenia**:
  - `onLoad` (effect) → fetch recipe
  - `onRetry` → ponowny fetch
  - `onChangeDraft` (delegowane do `RecipeEditForm`) → aktualizacja draftu + dirty
  - `onSave` → walidacja lokalna → `PATCH` → sukces: przekierowanie do `/recipes/{id}` (lub toast + pozostanie)
  - `onCancel` / nawigacja wstecz → jeśli `isDirty` → otwórz `UnsavedChangesAlertDialog`, inaczej przejdź do `/recipes/{id}`
  - `beforeunload` (effect) → gdy `isDirty === true`, ustaw `event.returnValue` (ochrona przed zamknięciem/refresh)
- **Walidacja (lokalna; zgodna z API)**:
  - `title`: string, trim, min 1, max 255
  - `ingredients`: min 1, max 200
    - każdy `ingredient.text`: trim, min 1, max 500
    - `ingredient.amount` (jeśli podane): liczba skończona, \(\ge 0\), max 1_000_000 (rekomendacja UI: \(\gt 0\) dla lepszej jakości danych)
    - `ingredient.unit` (jeśli podane): trim, min 1, max 50
    - `ingredient.no_scale`: boolean (opcjonalnie)
  - `steps`: min 1, max 200
    - każdy krok: trim, min 1, max 500
  - `servings`: int, \(\ge 1\), max 10_000
  - czasy:
    - `prep_time_minutes`: int, \(\ge 0\), max 1_000 (nullable w API)
    - `cook_time_minutes`: int, \(\ge 0\), max 1_000 (nullable w API)
    - `total_time_minutes`: int, \(\ge 0\), max 2_000 (nullable w API)
  - `calories_per_serving`: int, \(\ge 0\), max 100_000 (nullable w API)
  - `tags`: wartości string trim max 100; klucze jak w UI (`diet`, `course`, `cuisine`, `difficulty`)
  - **Ważne**: w API planie `tags` mają semantykę „merge”, co nie usuwa kluczy. Żeby toggle „odznacz” działał, backend powinien wspierać usuwanie (patrz sekcja 10 „Obsługa błędów / przypadki brzegowe” i „Wyzwania”).
- **Typy (DTO i ViewModel)**:
  - wejście: `RecipeDTO` z `GET /api/recipes/{id}`
  - wyjście: `PatchRecipeCommand` do `PATCH /api/recipes/{id}`
  - lokalnie: `RecipeEditDraftVM`, `RecipeEditValidationErrorsVM`, `RecipeEditViewState`
- **Propsy**:
  - `recipeId: string`

### `RecipeEditHeader`
- **Opis**: Nagłówek widoku „Edycja przepisu” (tytuł strony + kontekst prywatności + opcjonalnie breadcrumbs).
- **Główne elementy**:
  - `header`
  - `h1` (np. „Edytuj przepis”)
  - (opcjonalnie) opis pomocniczy + `RecipePrivacyNotice`
- **Obsługiwane zdarzenia**: brak lub `onBackClick` (jeśli w headerze jest przycisk „Wróć”).
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**:
  - opcjonalnie `recipeTitle?: string` (dla kontekstu)
  - opcjonalnie `onBack?: () => void`

### `RecipeEditForm`
- **Opis**: Prezentacyjny formularz edycji. Renderuje pola i emituje zdarzenia zmian.
- **Główne elementy / dzieci**:
  - `form` lub `div` (z `fieldset`ami jak w re-używanych edytorach)
  - `RecipeTitleField`
  - `RecipeIngredientsEditor`
  - `RecipeStepsEditor`
  - `RecipeMetaEditor`
- **Obsługiwane zdarzenia**:
  - `onChangeTitle(value: string)`
  - `onChangeIngredient(id: string, patch: Partial<RecipeIngredientDraftVM>)`
  - `onAddIngredient()`
  - `onRemoveIngredient(id: string)`
  - `onChangeStep(id: string, patch: Partial<RecipeStepDraftVM>)`
  - `onAddStep()`
  - `onRemoveStep(id: string)`
  - `onChangeMeta(patch: Partial<RecipeMetaDraftVM>)`
- **Walidacja**:
  - renderuje błędy inline przekazane w `errors`
  - nie waliduje samodzielnie (logika walidacji w `RecipeEditPage` lub hooku)
- **Typy**:
  - `RecipeEditDraftVM`
  - `RecipeEditValidationErrorsVM`
- **Propsy**:
  - `draft: RecipeEditDraftVM`
  - `errors: RecipeEditValidationErrorsVM | null`
  - `disabled?: boolean` (gdy loading/saving)
  - eventy zmian jak wyżej

### `RecipeEditFooterActions`
- **Opis**: CTA widoku: „Anuluj” i „Zapisz”.
- **Główne elementy**:
  - `Button` (outline) „Anuluj”
  - `Button` (primary) „Zapisz” / „Zapisywanie…”
  - (opcjonalnie) tekst pomocniczy „Masz niezapisane zmiany” gdy `isDirty`
- **Obsługiwane zdarzenia**:
  - `onCancel()`
  - `onSave()`
- **Walidacja**:
  - `onSave` powinien być disabled gdy `isSaving === true` lub `isDirty === false`
- **Typy**: brak (proste propsy).
- **Propsy**:
  - `isDirty: boolean`
  - `isSaving: boolean`
  - `onCancel: () => void`
  - `onSave: () => void`

### `UnsavedChangesAlertDialog`
- **Opis**: Dialog potwierdzający wyjście z widoku przy niezapisanych zmianach.
- **Główne elementy**: Shadcn `AlertDialog*` (Content, Header, Footer, Action, Cancel).
- **Obsługiwane zdarzenia**:
  - `onConfirmLeave()` → nawigacja (np. do `/recipes/{id}`)
  - `onStay()` → zamknięcie dialogu
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**:
  - `open: boolean`
  - `onOpenChange(open: boolean)`
  - `onConfirmLeave()`

## 5. Typy
Wymagane typy już istnieją w `src/types.ts`, ale do widoku przydadzą się dodatkowe ViewModel-e.

### DTO/Command (istniejące)
- **`RecipeDTO`**: dane przepisu z `GET /api/recipes/{id}` (do wypełnienia formularza).
- **`PatchRecipeCommand`**: payload do `PATCH /api/recipes/{id}`.
  - pola opcjonalne, nullable; arrays full-replace; `tags` w planie API jako merge.

### ViewModel (nowe, rekomendowane)
Zalecane utworzenie nowych typów w `src/components/recipe-edit/types.ts` (lub re-use z `recipe-create`, ale dla czytelności edycji lepsze osobne).

- **`RecipeEditDraftVM`**:
  - `title: string`
  - `ingredients: RecipeIngredientDraftVM[]`
  - `steps: RecipeStepDraftVM[]`
  - `meta: RecipeMetaDraftVM`
  - `meta.tags: Record<string, string>`
  - (opcjonalnie) `meta.total_time_minutes_mode: 'auto' | 'manual'` (patrz sekcja 6)

- **`RecipeEditValidationErrorsVM`**:
  - `title?: string`
  - `ingredients?: string`
  - `steps?: string`
  - `servings?: string`
  - `ingredientsById?: Record<string, { text?: string; amount?: string; unit?: string }>`
  - `stepsById?: Record<string, { text?: string }>`
  - (opcjonalnie) błędy pól meta: `prep_time_minutes?: string`, `cook_time_minutes?: string`, `total_time_minutes?: string`, `calories_per_serving?: string`

- **`RecipeEditViewState`**:
  - `{ status: 'loading' }`
  - `{ status: 'not_found' }`
  - `{ status: 'error'; error: { code?: string; message: string } }`
  - `{ status: 'ready'; data: { recipeId: string; initial: RecipeEditDraftVM; draft: RecipeEditDraftVM } }`

### Mapper (nowy, rekomendowany)
- `mapRecipeDtoToEditDraftVM(dto: RecipeDTO): RecipeEditDraftVM`
  - mapuje `dto.ingredients` → listę z lokalnymi `id` (np. `crypto.randomUUID()` lub prosty generator)
  - mapuje `dto.steps` → listę z lokalnymi `id`
  - mapuje `null` z DB na `undefined` w `meta.*` (spójnie z `RecipeMetaEditor`, który używa `undefined` jako „puste”)

## 6. Zarządzanie stanem
Rekomendacja: lokalny stan w `RecipeEditPage` + opcjonalny custom hook.

### Stan wymagany w `RecipeEditPage`
- **`viewState`**: `RecipeEditViewState`
- **`isSaving`**: boolean
- **`apiError`**: `{ code?: string; message: string } | null` (do `Alert`)
- **`validationErrors`**: `RecipeEditValidationErrorsVM | null`
- **`showUnsavedDialog`**: boolean
- **`pendingNavigationTarget`**: string | null (dokąd iść po potwierdzeniu)
- **`isDirty`**: boolean (wyliczany)
  - rekomendacja: porównywać znormalizowane `draft` vs `initial` (np. trim stringi, uporządkuj `tags` po kluczu, zamień `undefined` na `null` w polach liczbowych) i dopiero wtedy deep-compare

### Custom hook (opcjonalny, ale ułatwia)
`useRecipeEditForm(initial: RecipeEditDraftVM)`:
- trzyma `draft`, `setDraft` i zestaw akcji:
  - `setTitle`, `addIngredient`, `updateIngredient`, `removeIngredient`
  - `addStep`, `updateStep`, `removeStep`
  - `updateMeta`
- eksportuje `isDirty` (względem `initial`)
- eksportuje `buildPatchCommand()` (konwersja `RecipeEditDraftVM` → `PatchRecipeCommand`)

### Logika „auto total time” (zalecana)
API plan dopuszcza przeliczenie `total_time_minutes` na serwerze, jeśli pole jest pominięte i podano `prep` + `cook`. Żeby UX był przewidywalny:

- domyślnie traktuj `total_time_minutes` jako **auto** dopóki użytkownik nie edytuje pola „Czas całkowity”
- jeśli `auto` i użytkownik zmienia `prep`/`cook`, można:
  - albo wyświetlać computed helper tekst, a w payload **pominąć** `total_time_minutes`,
  - albo ustawiać wartość w UI i wysyłać jawnie (prościej, ale mniej zgodne z „server may recalculate”)
- jeśli użytkownik edytował „Czas całkowity”, przejdź na tryb **manual** i nie nadpisuj.

## 7. Integracja API
Widok wymaga dwóch wywołań API:

### `GET /api/recipes/{id}`
- **Cel**: pobranie danych do wypełnienia formularza.
- **Frontend**: istnieje `getRecipeById(id, signal?)` w `src/lib/api/recipes.ts`.
- **Response**: `{ data: RecipeDTO }`.

### `PATCH /api/recipes/{id}`
- **Cel**: zapis zmian (jedyna persystencja edycji).
- **Frontend**: dodać nową funkcję w `src/lib/api/recipes.ts`, np. `patchRecipe(id: string, cmd: PatchRecipeCommand): Promise<{ data: RecipeDTO }>`
  - `method: 'PATCH'`, `Content-Type: application/json`
  - mapowanie błędów jak w pozostałych metodach (`mapApiError`)
- **Request**: `PatchRecipeCommand` (z `src/types.ts`)
- **Response**: `{ data: RecipeDTO }`

**Uwaga implementacyjna**: w repo aktualnie endpoint `PATCH` nie jest zaimplementowany w `src/pages/api/recipes/[id].ts` (jest tylko `GET`). Sam widok FE zależy od dodania tego endpointu lub tymczasowego mocka. Plan FE zakłada, że backend zwróci `{ data: RecipeDTO }` oraz w razie walidacji `{ error: { message, code, fieldErrors } }` ze statusem 422 (lub 400 – obecnie create używa 400).

## 8. Interakcje użytkownika
- **Wejście na stronę**:
  - pobranie przepisu; pokazanie skeletona; po sukcesie wypełnienie formularza
- **Edycja pól**:
  - tytuł: wpisywanie tekstu
  - składniki: dodaj/usuń; edytuj tekst/ilość/jednostkę; toggle „nie skaluj”
  - kroki: dodaj/usuń; edytuj tekst
  - meta: porcje, kalorie, czasy, tagi (checkboxy)
- **Zapis**:
  - klik „Zapisz” → walidacja lokalna
  - jeśli OK → `PATCH` → po sukcesie przejście do szczegółu przepisu (`/recipes/{id}`) lub pokazanie komunikatu sukcesu
- **Anuluj / wyjście**:
  - klik „Anuluj”:
    - jeśli `isDirty=false` → przejście do `/recipes/{id}`
    - jeśli `isDirty=true` → `UnsavedChangesAlertDialog`
  - odświeżenie / zamknięcie karty:
    - jeśli `isDirty=true` → natywny prompt przeglądarki (`beforeunload`)

## 9. Warunki i walidacja
### Warunki weryfikowane po stronie UI
- **Wymagane pola**: tytuł, min 1 składnik, min 1 krok, porcje \(\ge 1\).
- **Limity długości**: zgodnie z `patchRecipeCommandSchema` (title/ingredients/steps/tags).
- **Zakres liczb**:
  - `servings` int 1..10_000
  - `calories_per_serving` int 0..100_000 lub puste (→ null)
  - czasy int:
    - `prep_time_minutes`, `cook_time_minutes`: 0..1_000 lub puste (→ null)
    - `total_time_minutes`: 0..2_000 lub puste (→ null / auto)
- **Warunki UI wpływające na stan**:
  - `isDirty`:
    - `true` → włącza guard (dialog + beforeunload), włącza przycisk „Zapisz”
    - `false` → „Zapisz” disabled
  - `isSaving`:
    - blokuje przyciski i edycję (opcjonalnie) + zmienia label na „Zapisywanie…”
  - `viewState`:
    - `loading` → skeleton
    - `not_found` → stan „nie znaleziono”
    - `error` → stan błędu z retry

### Warunki wymagane przez API i jak je weryfikować w komponentach
- Payload do `PATCH` musi spełniać `patchRecipeCommandSchema`:
  - w `RecipeEditPage` / hooku przygotować `buildPatchCommand()` i przed wysyłką:
    - trim stringi
    - usuń puste stringi w `unit` (zamień na `undefined`)
    - zamień puste pola liczbowe na `null` (jeśli intencją jest wyczyszczenie), albo pomiń pole (jeśli brak zmiany)
  - arrays (`ingredients`, `steps`) wysyłać jako pełny stan po edycji

## 10. Obsługa błędów
### Scenariusze błędów i rekomendowana obsługa
- **404 (NOT_FOUND)**:
  - pokaż stan „Przepis nie istnieje lub nie masz dostępu” + link „Wróć do listy”
- **401 (UNAUTHORIZED)**:
  - pokaż błąd i CTA „Przejdź do logowania” (jeśli w aplikacji istnieje `/login`)
- **422 / 400 (Validation failed)**:
  - pokaż błędy inline (mapowanie `fieldErrors` na pola)
  - dodatkowo utrzymaj lokalne błędy per składnik/krok (po `id`)
- **Błąd sieci / 500**:
  - pokaż `Alert`/stan błędu z retry
- **Konflikty semantyki `tags`**:
  - jeśli backend faktycznie robi merge i nie usuwa kluczy, UI „odznacz” nie zadziała.
  - rekomendacja do uzgodnienia z backendem:
    - zmienić semantykę `tags` w `PATCH` na **full replace**, albo
    - dopuścić `null` wartości per klucz (np. `{ diet: null }`) i dostosować walidację.
  - do czasu uzgodnienia: w UI można ograniczyć edycję tagów do „ustaw/zmień”, a usuwanie traktować jako „wyczyść wszystkie tagi” (wysłanie `tags: null`) – ale to gorszy UX.

## 11. Kroki implementacji
1. **Routing**: dodać stronę `src/pages/recipes/[id]/edit.astro` zgodnie z konwencją istniejących stron `recipes`.
2. **Struktura katalogów komponentów**: utworzyć `src/components/recipe-edit/` z plikami:
   - `RecipeEditPage.tsx`
   - `types.ts`
   - `mappers.ts`
   - `components/RecipeEditHeader.tsx`
   - `components/RecipeEditFooterActions.tsx`
   - `components/UnsavedChangesAlertDialog.tsx`
3. **Mapper DTO → draft**: zaimplementować `mapRecipeDtoToEditDraftVM` (dodanie lokalnych `id` dla list).
4. **Stan i ładowanie**: w `RecipeEditPage` skopiować podejście z `RecipeDetailsPage`:
   - `useAbortableFetch` + `getRecipeById(recipeId, signal)`
   - obsłużyć `loading/not_found/error/ready`
5. **Re-use edytorów**: złożyć `RecipeEditForm` używając:
   - `RecipeTitleField`
   - `RecipeIngredientsEditor`
   - `RecipeStepsEditor`
   - `RecipeMetaEditor`
6. **Walidacja lokalna**: dodać funkcję `validateDraft(draft): RecipeEditValidationErrorsVM`.
7. **Dirty tracking**: dodać snapshot `initial` i wyliczanie `isDirty` (normalizacja + deep compare).
8. **Guard wyjścia**:
   - dodać `UnsavedChangesAlertDialog` dla „Anuluj”
   - dodać `beforeunload` effect aktywny tylko gdy `isDirty===true`
9. **API client dla PATCH**:
   - dodać `patchRecipe` do `src/lib/api/recipes.ts` (wykorzystać `PatchRecipeCommand` + `mapApiError`)
10. **Save flow**:
   - na `onSave`: walidacja lokalna → build payload → `patchRecipe` → sukces: redirect do `/recipes/{id}`
   - na błąd: ustaw `apiError` + ewentualnie `validationErrors` z `fieldErrors`
11. **UI polish / a11y**:
   - focus na pierwszym błędzie po nieudanym zapisie
   - `aria-invalid` na polach z błędami (częściowo już w edytorach)
   - upewnić się, że dialog ma poprawny focus trap (Shadcn)
12. **Uzgodnienie semantyki `tags`**:
   - przed finalnym merge: upewnić się, że backend wspiera usuwanie tagów (w przeciwnym razie doprecyzować zachowanie w UI).
