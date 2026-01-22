## Plan implementacji widoku Tworzenie przepisu (wizard)

## 1. Przegląd

Widok **Tworzenie przepisu (wizard)** umożliwia użytkownikowi:
- wklejenie surowego tekstu przepisu,
- automatyczne **zestrukturyzowanie** go do pól (tytuł, składniki, kroki) wraz z **confidence per pole**,
- ręczną korektę danych,
- zapis przez `POST /api/recipes` (przepis prywatny do konta).

Wymagania MVP wynikające z PRD i UI planu:
- **Pola wymagane**: tytuł, składniki (tekst), kroki.
- **Confidence per pole** i podświetlenia/ostrzeżenia dla \(confidence < 0{,}9\).
- **Normalizacja jednostek** do g/ml/szt (w MVP preferowane **parsowanie po stronie klienta**).
- **Zapis dozwolony mimo niskiego confidence**, ale z ostrzeżeniem.
- **Prywatność**: komunikat w UI, że dane są prywatne; brak automatycznego zapisu szkicu.

## 2. Routing widoku

- **Ścieżka**: `/recipes/new`
- **Plik strony**: `src/pages/recipes/new.astro` (nowy)
- **Layout**: `src/layouts/Layout.astro`
- **Hydratacja**: komponent React z `client:load` (wizard jest interaktywny).

## 3. Struktura komponentów

Proponowany podział: strona Astro dostarcza shell (layout + `<main>`), a logikę w całości realizuje React.

**Wysokopoziomowe drzewo komponentów**:
- `src/pages/recipes/new.astro`
  - `Layout`
    - `<main>`
      - `RecipeCreateWizardPage` (React, `client:load`)
        - `RecipeCreateWizardHeader`
          - `RecipeCreateStepIndicator` (krok + progress)
          - `RecipePrivacyNotice`
        - `RecipeCreateWizardBody`
          - (Step 1) `RecipeCreatePasteStep`
            - `RecipeRawInput` (Textarea)
            - `RecipePasteFormattingHints`
            - `RecipeCreateStepActions` (Dalej → „Zestrukturyzuj”)
          - (Step 2) `RecipeCreateReviewStep`
            - `RecipeLowConfidenceSummary` (Alert, jeśli są pola < 0,9)
            - `RecipeTitleField` (+ `RecipeConfidenceBadge`)
            - `RecipeIngredientsEditor`
              - `RecipeIngredientRow` (xN, + `RecipeConfidenceBadge`)
            - `RecipeStepsEditor`
              - `RecipeStepRow` (xN, + `RecipeConfidenceBadge`)
            - `RecipeMetaEditor` (min. `servings`, opcjonalnie czasy/kalorie/tags)
            - `RecipeCreateFooterActions` (Wstecz / Zapisz)
        - `RecipeCreateSavingOverlay` (opcjonalnie)
        - `RecipeCreateErrorToast/Alert` (dla błędów API)

## 4. Szczegóły komponentów

### `src/pages/recipes/new.astro`
- **Opis komponentu**: Definiuje routing `/recipes/new`, osadza `Layout` i mountuje Reactowy wizard.
- **Główne elementy**:
  - `<Layout title="Nowy przepis">`
  - `<main class="...">`
  - `RecipeCreateWizardPage client:load`
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak.
- **Typy**: brak.
- **Propsy**: brak.

### `RecipeCreateWizardPage` (React, top-level view)
- **Opis komponentu**: Kontener widoku. Zarządza krokami, uruchamia parser, utrzymuje draft danych, waliduje przed zapisem i integruje się z API `POST /api/recipes`.
- **Główne elementy**:
  - `<section>` wrapper (spójny z innymi widokami: `max-w-6xl`, paddingi)
  - `RecipeCreateWizardHeader`
  - `RecipeCreatePasteStep` / `RecipeCreateReviewStep` (render warunkowy na podstawie `step`)
  - komponenty stanu zapisu/błędów
- **Obsługiwane zdarzenia**:
  - `onRawChange(raw: string)`
  - `onNextFromPaste()` → parsowanie + przejście do kroku 2
  - `onBackToPaste()` → powrót do kroku 1 (bez automatycznego nadpisywania ręcznych edycji)
  - `onReparse()` (opcjonalnie w kroku 2) → ponowne parsowanie z aktualnego `raw`
  - `onEditTitle(value)`
  - `onEditIngredient(id, patch)` / `onAddIngredient()` / `onRemoveIngredient(id)`
  - `onEditStep(id, patch)` / `onAddStep()` / `onRemoveStep(id)`
  - `onEditMeta(patch)` (servings/times/calories/tags)
  - `onSave()` → `POST /api/recipes`
- **Warunki walidacji (frontend, zgodne z API i PRD)**:
  - **Krok 1**:
    - `raw.trim().length > 0` aby umożliwić „Dalej” (minimalny gate UX; nie jest to walidacja API).
  - **Krok 2 (przed zapisem)**:
    - `title`: `trim()`, **wymagane**, `length >= 1` (zalecany limit UI: `<= 200`).
    - `ingredients`: **wymagane**, `length >= 1`.
      - każdy składnik: `text.trim().length >= 1`.
      - jeśli `amount` podany: `Number.isFinite(amount)` i `amount > 0`.
      - jeśli `unit` podany: `trim().length >= 1` (normalizujemy do g/ml/szt, ale nie blokujemy unknown).
      - `no_scale` domyślnie `false` (w tym widoku zwykle nie eksponujemy, ale można dodać toggle per składnik).
    - `steps`: **wymagane**, `length >= 1`.
      - każdy krok: `text.trim().length >= 1` (na wyjściu do API mapujemy na `string[]`).
    - `servings`: **wymagane przez API** (`CreateRecipeCommand`), `int`, `>= 1` (zalecany clamp UI: `<= 1000`).
    - `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`, `calories_per_serving` (jeśli eksponowane):
      - `int`, `>= 0` lub `undefined` (nie wysyłamy, jeśli puste).
    - `tags`:
      - zawsze wysyłamy obiekt (`{}` jeśli brak), wartości string.
  - **Confidence**:
    - `confidenceThreshold = 0.9`.
    - jeśli jakiekolwiek pole ma \(confidence < 0{,}9\), „Zapisz” nadal dostępny, ale pokazujemy ostrzeżenie przed finalnym submit (np. `AlertDialog`).
- **Typy**:
  - DTO/command: `CreateRecipeCommand`, `RecipeDTO` (z `src/types.ts`)
  - ViewModel: `RecipeCreateWizardState`, `RecipeDraftVM`, `RecipeParseResultVM`, `RecipeCreateValidationErrorsVM`
  - API errors: `ApiError` (server) i `ApiMappedError` (client mapper)
- **Propsy**: brak (top-level view).

### `RecipeCreateWizardHeader`
- **Opis komponentu**: Nagłówek widoku z tytułem, wskaźnikiem kroku i komunikatem o prywatności.
- **Główne elementy**:
  - `<header>`
  - `h1` („Nowy przepis”)
  - `RecipeCreateStepIndicator` (np. „Krok 1/2” + progress bar)
  - `RecipePrivacyNotice` (krótka notka „Przepisy są prywatne…”)
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak.
- **Typy**: `RecipeCreateWizardStep`.
- **Propsy**:
  - `step: RecipeCreateWizardStep`
  - `progress: number` (0..1) lub `currentStep/totalSteps`

### `RecipeCreatePasteStep` (Step 1)
- **Opis komponentu**: Krok wklejenia surowego przepisu.
- **Główne elementy**:
  - `<section>`
  - `Label` + `Textarea` (shadcn/ui `Textarea`)
  - `RecipePasteFormattingHints` (np. sugestia bullet list dla składników/kroków)
  - `Button` „Dalej” (uruchamia parsowanie)
- **Obsługiwane zdarzenia**:
  - `onChange(raw)`
  - `onNext()` (klik „Dalej”)
- **Warunki walidacji**:
  - `raw.trim().length > 0` → enable „Dalej”; w przeciwnym razie pokazujemy hint/inline error.
- **Typy**:
  - VM: `RecipeRawDraftVM`
- **Propsy**:
  - `raw: string`
  - `onRawChange: (next: string) => void`
  - `onNext: () => void`
  - `canNext: boolean`

### `RecipeCreateReviewStep` (Step 2)
- **Opis komponentu**: Podgląd struktury (tytuł/składniki/kroki) z edycją, badge confidence i ostrzeżeniami.
- **Główne elementy**:
  - `<section>`
  - `RecipeLowConfidenceSummary` (`Alert`), jeśli są pola < 0,9
  - Pola edycyjne:
    - `RecipeTitleField` (`Input`)
    - `RecipeIngredientsEditor` (lista + add/remove)
    - `RecipeStepsEditor` (lista + add/remove)
    - `RecipeMetaEditor` (minimum `servings`)
  - `RecipeCreateFooterActions` (Wstecz, Zapisz)
- **Obsługiwane zdarzenia**:
  - `onBack()`
  - `onReparse()` (opcjonalnie)
  - `onChangeTitle(value)`
  - `onChangeIngredient(id, patch)`
  - `onAddIngredient()`, `onRemoveIngredient(id)`
  - `onChangeStep(id, patch)`
  - `onAddStep()`, `onRemoveStep(id)`
  - `onChangeMeta(patch)`
  - `onSave()`
- **Warunki walidacji**:
  - wszystkie warunki z sekcji `RecipeCreateWizardPage` (krok 2)
  - pokazujemy błędy inline per pole (w tym mapowanie `fieldErrors` z 422, jeśli dostępne).
- **Typy**:
  - VM: `RecipeDraftVM`, `RecipeFieldConfidenceVM`, `RecipeCreateValidationErrorsVM`
- **Propsy**:
  - `draft: RecipeDraftVM`
  - `errors: RecipeCreateValidationErrorsVM | null`
  - `hasLowConfidence: boolean`
  - `onBack: () => void`
  - `onReparse?: () => void`
  - `onChangeDraft: (patch: RecipeDraftPatch) => void` (lub zestaw wyspecjalizowanych handlerów)
  - `onSave: () => void`
  - `isSaving: boolean`

### `RecipeConfidenceBadge`
- **Opis komponentu**: Ujednolicony badge confidence (np. „0.86”) z wariantami stylu.
- **Główne elementy**:
  - shadcn/ui `Badge`
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak (prezentacja).
- **Typy**: `confidence: number`.
- **Propsy**:
  - `confidence: number | null` (null dla „manual/unknown”)
  - `threshold?: number` (domyślnie 0.9)

### `RecipeIngredientsEditor`
- **Opis komponentu**: Edycja listy składników. W MVP przechowujemy zawsze `text`, a `amount/unit` są opcjonalne (wspiera normalizację do g/ml/szt, jeśli parser je wykryje).
- **Główne elementy**:
  - `<fieldset>` z `legend` („Składniki”)
  - `<ul>` z wierszami `RecipeIngredientRow`
  - `Button` „Dodaj składnik”
- **Obsługiwane zdarzenia**:
  - `onChangeIngredient(id, patch)`
  - `onAdd()`, `onRemove(id)`
- **Warunki walidacji**:
  - lista niepusta
  - `ingredient.text.trim().length >= 1`
  - jeśli `amount` obecny: `> 0`
  - jeśli `unit` obecny: niepusty; w UI sugerujemy listę wartości docelowych `g|ml|szt` (Select), ale pozwalamy wpisać (fallback).
- **Typy**:
  - VM: `RecipeIngredientDraftVM`
- **Propsy**:
  - `items: RecipeIngredientDraftVM[]`
  - `errorsById?: Record<string, { text?: string; amount?: string; unit?: string }>`
  - `onChange: (id: string, patch: Partial<RecipeIngredientDraftVM>) => void`
  - `onAdd: () => void`
  - `onRemove: (id: string) => void`

### `RecipeStepsEditor`
- **Opis komponentu**: Edycja kroków przepisu (lista). W API kroki to `string[]`, więc w VM trzymamy `StepDraftVM` i mapujemy do tablicy stringów.
- **Główne elementy**:
  - `<fieldset>` z `legend` („Kroki”)
  - `<ol>` z wierszami `RecipeStepRow`
  - `Button` „Dodaj krok”
- **Obsługiwane zdarzenia**:
  - `onChangeStep(id, patch)`
  - `onAdd()`, `onRemove(id)`
- **Warunki walidacji**:
  - lista niepusta
  - `step.text.trim().length >= 1`
- **Typy**:
  - VM: `RecipeStepDraftVM`
- **Propsy**:
  - `items: RecipeStepDraftVM[]`
  - `errorsById?: Record<string, { text?: string }>`
  - `onChange: (id: string, patch: Partial<RecipeStepDraftVM>) => void`
  - `onAdd: () => void`
  - `onRemove: (id: string) => void`

### `RecipeMetaEditor`
- **Opis komponentu**: Metadane dla przepisu. Minimum to `servings` (wymagane przez API). Reszta pól opcjonalna.
- **Główne elementy**:
  - `Input type="number"` dla `servings`
  - (opcjonalnie) `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`, `calories_per_serving`
  - (opcjonalnie) pola tagów (np. dieta/kurs) jako `Select`/`Input`
- **Obsługiwane zdarzenia**:
  - `onChange(patch)`
- **Warunki walidacji**:
  - `servings`: int `>= 1`
  - pozostałe liczby: int `>= 0` (jeśli podane)
  - `tags`: obiekt string→string (trim; puste wartości pomijamy)
- **Typy**:
  - VM: `RecipeMetaDraftVM`, `RecipeTagsDraftVM`
- **Propsy**:
  - `meta: RecipeMetaDraftVM`
  - `errors?: { servings?: string; prep?: string; cook?: string; total?: string; calories?: string }`
  - `onChange: (patch: Partial<RecipeMetaDraftVM>) => void`

### `RecipeLowConfidenceSummary`
- **Opis komponentu**: Zbiorcze ostrzeżenie o niskim confidence (US-021/022).
- **Główne elementy**:
  - shadcn/ui `Alert` (variant warning)
  - lista pól z niskim confidence (np. „Tytuł”, „Składniki”, „Kroki”)
- **Obsługiwane zdarzenia**: brak (opcjonalnie link-scroll do sekcji).
- **Warunki walidacji**: brak.
- **Typy**: `LowConfidenceIssueVM[]`.
- **Propsy**:
  - `issues: LowConfidenceIssueVM[]`
  - `threshold: number`

## 5. Typy

### Typy istniejące (źródło: `src/types.ts`)
- **`RecipeIngredientDTO`**
  - `text: string`
  - `unit?: string`
  - `amount?: number`
  - `no_scale?: boolean`
- **`RecipeTags`**: `Record<string, string>`
- **`CreateRecipeCommand`**
  - `title: string`
  - `ingredients: RecipeIngredientDTO[]`
  - `steps: string[]`
  - `tags: RecipeTags`
  - `prep_time_minutes?: number`
  - `cook_time_minutes?: number`
  - `total_time_minutes?: number`
  - `calories_per_serving?: number`
  - `servings: number`
- **`RecipeDTO`**: obiekt przepisu w odpowiedzi (po utworzeniu używany do redirectu)
- **Helper types (opcjonalne do reuse)**: `ExtractedValue<T>`, `ExtractedIngredient`, `ExtractedStep`, `RecipeStructureResponseData`
  - W MVP parser jest kliencki, ale możemy utrzymać zbliżony shape (ułatwia ewentualne przejście na `POST /api/recipes/structure`).

### Nowe typy (ViewModel / UI) – rekomendowane miejsce: `src/components/recipe-create/types.ts`

#### `type RecipeCreateWizardStep = 'paste' | 'review'`

#### `type RecipeFieldConfidenceVM`
```ts
type RecipeFieldConfidenceVM = {
  title: number | null
  ingredients: number | null
  steps: number | null
}
```
Uwagi:
- `null` oznacza „brak danych o confidence” (np. w pełni manualnie wpisane).

#### `type RecipeIngredientDraftVM`
```ts
type RecipeIngredientDraftVM = {
  id: string
  text: string
  amount?: number
  unit?: string
  no_scale?: boolean
  confidence?: number
}
```

#### `type RecipeStepDraftVM`
```ts
type RecipeStepDraftVM = {
  id: string
  text: string
  confidence?: number
}
```

#### `type RecipeMetaDraftVM`
```ts
type RecipeMetaDraftVM = {
  servings: number
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  calories_per_serving?: number
  tags: Record<string, string>
}
```

#### `type RecipeDraftVM`
```ts
type RecipeDraftVM = {
  raw: string
  title: { value: string; confidence: number | null; source: 'parsed' | 'manual' }
  ingredients: Array<{ value: RecipeIngredientDraftVM; source: 'parsed' | 'manual' }>
  steps: Array<{ value: RecipeStepDraftVM; source: 'parsed' | 'manual' }>
  meta: RecipeMetaDraftVM
  warnings: string[]
}
```

#### `type RecipeCreateValidationErrorsVM`
```ts
type RecipeCreateValidationErrorsVM = {
  title?: string
  ingredients?: string
  steps?: string
  servings?: string
  ingredientsById?: Record<string, { text?: string; amount?: string; unit?: string }>
  stepsById?: Record<string, { text?: string }>
}
```

#### `type LowConfidenceIssueVM`
```ts
type LowConfidenceIssueVM = {
  field: 'title' | 'ingredients' | 'steps'
  confidence: number
  label: string
}
```

## 6. Zarządzanie stanem

Wizard jest w pełni klientowy; stan trzymamy lokalnie w React.

### Stan główny
- `step: RecipeCreateWizardStep`
- `draft: RecipeDraftVM`
- `validationErrors: RecipeCreateValidationErrorsVM | null`
- `isSaving: boolean`
- `apiError: { code?: string; message: string } | null`
- `confidenceThreshold = 0.9`
- `hasLowConfidence: boolean` (wyliczane na podstawie `draft.*.confidence`)

### Proponowany custom hook
#### `useRecipeCreateWizardState()`
- **Cel**: ustandaryzować zarządzanie stanem (reducer) + akcje.
- **API hooka (przykład)**:
  - `state` (jak wyżej)
  - `actions.setRaw(raw)`
  - `actions.parseAndGoNext()` (krok 1 → 2)
  - `actions.goBack()`
  - `actions.reparse()` (opcjonalnie)
  - `actions.updateTitle(value)`
  - `actions.updateIngredient(id, patch)` / `addIngredient()` / `removeIngredient(id)`
  - `actions.updateStep(id, patch)` / `addStep()` / `removeStep(id)`
  - `actions.updateMeta(patch)`
  - `actions.validate()` (ustawia `validationErrors`)
  - `actions.save()` (wywołuje API; po sukcesie redirect)

### Parser (MVP: klientowy)
#### `parseRawRecipeToDraft(raw: string): { draft: Partial<RecipeDraftVM>; confidences: RecipeFieldConfidenceVM; warnings: string[] }`
- **Cel**: heurystycznie wyciągnąć tytuł/składniki/kroki i znormalizować jednostki.
- **Założenia i podejście**:
  - Detekcja sekcji po nagłówkach (warianty PL/EN): „Składniki/Ingredients”, „Przygotowanie/Instrukcja/Steps”.
  - Składniki: linie z bulletami / numeracją; kroki: linie numerowane lub oddzielone pustą linią.
  - Normalizacja ilości:
    - rozpoznawanie `amount` (liczby + ułamki proste) oraz jednostek,
    - mapowanie jednostek masy/objętości do `g/ml` (np. kg→g, l→ml, dag→g),
    - „szt” dla jednostek typu „szt., pcs”,
    - jeśli parsowanie niepewne: zostawiamy tylko `text` i obniżamy confidence.
  - Confidence:
    - `title`: wysoki jeśli wykryto pojedynczy sensowny nagłówek, niski jeśli brak lub wiele kandydatów.
    - `ingredients/steps`: zależnie od liczby wykrytych pozycji i spójności formatu.
  - Warnings:
    - brak wykrytych składników/kroków,
    - wykryto nietypowe jednostki lub wartości nieparsowalne,
    - bardzo długie linie (podejrzenie złego formatu).

### (Opcjonalnie) Guard przed utratą danych
PRD zabrania **autosave**, ale nie zabrania ostrzegania przed utratą pracy:
- dodać `beforeunload` tylko jeśli użytkownik ma `draft.raw` lub wykonał edycje w kroku 2 (stan „dirty”).
- brak modala, gdy stan „clean”.

## 7. Integracja API

### Endpoint
- **Metoda/URL**: `POST /api/recipes`
- **Request body**: `CreateRecipeCommand` (`src/types.ts`)
- **Response 201**: `{ data: RecipeDTO }` (wg planu API)
- **Błędy**:
  - `401` (brak sesji)
  - `422` (nieprawidłowy payload; możliwe `fieldErrors`)

### Warstwa frontendu (zalecane rozszerzenie `src/lib/api/recipes.ts`)
Aktualnie klient ma `listRecipes`, `getRecipeById`, `putRecipeFavorite`, `putRecipeRating`, `deleteRecipeRating`, `deleteRecipe`.
Dla tego widoku potrzebujemy dodać:
- `createRecipe(cmd: CreateRecipeCommand): Promise<{ data: RecipeDTO }>`

Wymagania implementacyjne dla `createRecipe` (spójne z istniejącym stylem w `src/lib/api/recipes.ts`):
- `fetch('/api/recipes', { method: 'POST', headers: { Accept, Content-Type }, body: JSON.stringify(cmd) })`
- mapowanie błędu do `{ code?: string; message: string }` (jak `mapApiError`)
- w przypadku `422` przechować `ApiError.error.fieldErrors` do mapowania na błędy formularza (jeśli backend je zwraca).

### Akcje frontendowe po sukcesie
- po otrzymaniu `RecipeDTO` → redirect do `/recipes/${data.id}`.
- opcjonalnie: toast „Przepis zapisany”.

## 8. Interakcje użytkownika

- **Wklejanie przepisu (krok 1)**:
  - użytkownik wkleja tekst,
  - „Dalej” jest aktywne, gdy tekst nie jest pusty.
- **Przejście do podglądu (krok 2)**:
  - po kliknięciu „Dalej” uruchamia się parser,
  - UI pokazuje pola do edycji + confidence badges,
  - jeśli confidence < 0,9 → pokazujemy `Alert` + wizualne podświetlenia.
- **Edycja danych (krok 2)**:
  - edycja tytułu,
  - dodawanie/usuwanie/edycja składników,
  - dodawanie/usuwanie/edycja kroków,
  - ustawienie `servings` (wymagane),
  - (opcjonalnie) meta: czasy/kalorie/tagi.
- **Zapis**:
  - klik „Zapisz” uruchamia walidację frontendu,
  - jeśli są pola z low-confidence → pokazujemy ostrzeżenie (np. `AlertDialog`) z opcją „Zapisz mimo to”,
  - w trakcie zapisu: `isSaving=true`, disable przyciski, opcjonalny overlay/spinner.
- **Powrót**:
  - „Wstecz” przenosi do kroku 1; nie tracimy tekstu i nie nadpisujemy ręcznych edycji bez jawnej akcji „Przeparsuj”.

## 9. Warunki i walidacja

### Warunki weryfikowane przez UI (komponenty i wpływ na stan)
- **`RecipeCreatePasteStep`**
  - `raw.trim().length > 0`:
    - jeśli false → disable „Dalej” i pokaz hint.
- **`RecipeCreateReviewStep`**
  - `title` pusty → błąd inline + disable submit lub blokada w `onSave`.
  - `ingredients.length === 0` lub istnieje element z pustym `text` → błąd inline.
  - `steps.length === 0` lub istnieje element z pustym `text` → błąd inline.
  - `servings < 1` → błąd inline.
  - jeśli `amount` jest `NaN` lub `<= 0` → błąd inline.
  - `hasLowConfidence === true`:
    - pokaz `Alert` w kroku 2,
    - przy zapisie pokaż ostrzeżenie i dopiero po potwierdzeniu wykonaj request.

### Warunki wynikające z API i jak je weryfikować
- **Payload zgodny z `CreateRecipeCommand`**:
  - zawsze wysyłamy `tags` jako obiekt (nawet pusty),
  - `servings` zawsze obecne i dodatnie,
  - `ingredients` jako tablica obiektów (zawsze `text` niepusty),
  - `steps` jako `string[]` (niepuste stringi).
- **Obsługa `422`**:
  - jeśli backend zwróci `fieldErrors`, mapujemy je na `RecipeCreateValidationErrorsVM` i pokazujemy przy polach.
- **Obsługa `401`**:
  - pokaż komunikat o konieczności logowania i CTA do `/login` (lub zgodnie z istniejącym mechanizmem auth/guardów w aplikacji).

## 10. Obsługa błędów

Potencjalne scenariusze i rekomendowana obsługa:
- **Parser nie potrafi wyciągnąć struktury**:
  - przejście do kroku 2 z pustymi listami i niskim confidence + warning,
  - użytkownik uzupełnia ręcznie; walidacja wymusza minimalne pola przed zapisem.
- **Błąd sieci / 5xx** podczas `POST /api/recipes`:
  - zachowaj draft, pokaż `Alert`/toast „Nie udało się zapisać. Spróbuj ponownie.”
- **`401 Unauthorized`**:
  - komunikat „Sesja wygasła” + przekierowanie do logowania (jeśli aplikacja ma globalny mechanizm).
- **`422 Unprocessable Entity`**:
  - mapowanie `fieldErrors` na UI; jeśli brak `fieldErrors`, pokaż ogólny komunikat walidacji.
- **Duży tekst / wolna przeglądarka**:
  - parser wykonuj synchronicznie tylko dla prostych heurystyk; jeśli rozrośnie się, przenieś do Web Workera (opcja rozwojowa, nie MVP).

## 11. Kroki implementacji

1. **Routing**: dodaj `src/pages/recipes/new.astro` i osadź `Layout` + `RecipeCreateWizardPage client:load`.
2. **Struktura komponentów**: utwórz katalog `src/components/recipe-create/` z plikami:
   - `RecipeCreateWizardPage.tsx`
   - `types.ts`
   - `components/*` (header, step1, step2, editors, badge/alerts)
3. **Stan i typy**:
   - zaimplementuj `RecipeDraftVM`, `RecipeCreateWizardStep`, `RecipeCreateValidationErrorsVM`,
   - dodaj reducer i hook `useRecipeCreateWizardState()`.
4. **Parser klientowy**:
   - utwórz `src/components/recipe-create/parser.ts` z `parseRawRecipeToDraft(raw)` + funkcjami normalizacji jednostek,
   - ustaw `confidence` i `warnings` zgodnie z heurystykami.
5. **Krok 1**:
   - Textarea + hinty formatowania,
   - logika `canNext` i focus management (po przejściu do kroku 2 focus na tytuł).
6. **Krok 2 – edycja**:
   - pola tytułu, składników i kroków z add/remove,
   - `RecipeConfidenceBadge` przy sekcjach i elementach,
   - `RecipeLowConfidenceSummary` + podświetlenia pól poniżej progu.
7. **Walidacja formularza**:
   - lokalna walidacja przed zapisem, mapowanie błędów na VM,
   - logika ostrzeżenia „Zapisz mimo to” przy low-confidence.
8. **Integracja API**:
   - dodaj `createRecipe(cmd)` do `src/lib/api/recipes.ts` (spójnie z obecnym mapowaniem błędów),
   - w `onSave` wywołaj `createRecipe`, obsłuż `isSaving`, `apiError`, `422 fieldErrors`,
   - po sukcesie redirect do `/recipes/{id}`.
9. **A11y i UX**:
   - poprawne etykiety pól, opisy błędów i focus na pierwszym błędzie po nieudanym submit,
   - czytelne ostrzeżenia dla SR (np. `aria-live` dla summary błędów).
10. **Testy manualne (MVP)**:
   - przypadek happy path (dobrze sformatowany przepis),
   - przypadek low-confidence (nietypowy format) i zapis „mimo to”,
   - przypadek brak wymaganych pól (walidacja),
   - błędy API 401/422/5xx (draft nie ginie).

