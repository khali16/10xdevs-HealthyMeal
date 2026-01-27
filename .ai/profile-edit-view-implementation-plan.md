## Plan implementacji widoku Edycja profilu preferencji

## 1. Przegląd

Widok **Edycja profilu preferencji** umożliwia użytkownikowi zarządzanie preferencjami żywieniowymi, które wpływają na:
- parametry akcji AI „Dostosuj przepis” (alergeny, wykluczenia, dieta, cele),
- domyślne ustawienia skalowania porcji (opcjonalnie: bazowa liczba porcji).

Widok jest „pełnym” odpowiednikiem onboardingu (bez presji czasu), z dodatkową informacją o **ostatniej aktualizacji** oraz solidną obsługą błędów API (401/404/400/500/429).

## 2. Routing widoku

- **Ścieżka**: `/profile/edit`
- **Plik strony (Astro)**: `src/pages/profile/edit.astro` (nowy)
- **Layout**: `src/layouts/Layout.astro`
- **Mount React**: analogicznie do istniejących stron (`/recipes/new`, `/recipes/[id]/edit`) — komponent React osadzony z `client:load`.

Uwagi:
- W UI-plan wspomniano opcjonalnie `GET /api/me` dla stanu kompletności profilu, ale w repo nie ma jeszcze endpointu `/api/me`. Widok powinien działać niezależnie od tego (kompletność można wyliczać lokalnie na podstawie formularza).

## 3. Struktura komponentów

Proponowane drzewo komponentów (wysoki poziom):

- `src/pages/profile/edit.astro`
  - `Layout`
    - `<main>`
      - `UserPreferencesEditPage` (React, `client:load`)
        - `UserPreferencesEditHeader`
          - tytuł + opis
          - (opcjonalnie) badge/tekst: „Ostatnia aktualizacja: …”
        - `UserPreferencesEditBody`
          - `UserPreferencesEditStates` (loading / error / unauthorized)
          - `UserPreferencesForm` (w trybie „full”)
            - `AllergensFieldset`
            - `ExclusionsFieldset`
            - `DietFieldset`
            - `TargetsFieldset` (opcjonalne kalorie/porcje)
            - `FormActions` (Zapisz / Anuluj)
        - `SaveResultAlert` (sukces/błąd, opcjonalnie toast)

## 4. Szczegóły komponentów

### `src/pages/profile/edit.astro`

- **Opis**: Definiuje routing `/profile/edit`, osadza layout i mountuje Reactowy kontener edycji preferencji.
- **Główne elementy**:
  - `<Layout title="Profil — preferencje">`
  - `<main class="min-h-screen bg-background text-foreground">`
  - `<UserPreferencesEditPage client:load />`
- **Obsługiwane zdarzenia**: brak.
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**: brak.

### `UserPreferencesEditPage` (React)

- **Opis**: Kontener widoku. Odpowiada za:
  - pobranie aktualnych preferencji (`GET /api/user/preferences`),
  - pobranie słownika alergenów z bazy (bez hardcodowania listy po stronie UI),
  - zainicjalizowanie wartości formularza,
  - zapis (`PUT /api/user/preferences`) i obsługę stanów `isSaving`,
  - mapowanie błędów API na błędy pól (`fieldErrors`) oraz błąd ogólny.
- **Główne elementy HTML i dzieci**:
  - `<section className="mx-auto w-full max-w-3xl px-4 py-8">`
  - `UserPreferencesEditHeader`
  - warunkowo: skeleton / error state
  - `UserPreferencesForm`
- **Obsługiwane zdarzenia**:
  - `onRetryLoad()` — ponowne pobranie danych
  - `onSubmit(cmd)` — zapis preferencji
  - `onCancel()` — powrót/nawigacja (np. do `/recipes` lub poprzedniej strony)
- **Walidacja (pre-flight w UI, zgodnie z API + PRD)**:
  - `allergens`:
    - wymagane (tablica może być pusta),
    - max 200 elementów,
    - każdy element: string po trim, długość 1–100,
    - **wartości tylko z listy aktywnych alergenów ze słownika w bazie** — UI waliduje „subset of dictionary”, aby spełnić AC US‑011 (14 UE wynika z danych słownika, a nie z tablicy w kodzie).
  - `exclusions`:
    - wymagane (tablica może być pusta),
    - max 200 elementów,
    - każdy element: string po trim, długość 1–100,
    - deduplikacja (case-insensitive) i normalizacja białych znaków.
  - `diet`:
    - `null` albo string po trim o długości 1–50,
    - UI powinien ograniczać do znanej listy opcji (patrz `DietFieldset`), ale tolerować `null`.
  - `target_calories`:
    - `null` albo dodatnia liczba całkowita,
    - UI: `min=1`, `step=1`.
  - `target_servings`:
    - `null` albo dodatnia liczba całkowita,
    - UI: `min=1`, `step=1`.
- **Typy (DTO i ViewModel)**:
  - DTO: `UserPreferencesDTO`, `UpsertUserPreferencesCommand`, `ApiSuccess<T>`, `ApiError` (z `src/types.ts`)
  - VM: `UserPreferencesFormValues`, `UserPreferencesViewState`, `UserPreferencesFieldErrorsVM`
- **Propsy**:
  - brak (top-level view).

### `UserPreferencesEditHeader`

- **Opis**: Nagłówek widoku z tytułem, krótkim opisem oraz informacją o ostatniej aktualizacji.
- **Główne elementy**:
  - `<header>`
  - `h1` (np. „Preferencje żywieniowe”)
  - `p` (np. „Wpływają na dostosowania AI i skalowanie porcji.”)
  - (opcjonalnie) `Badge`/tekst z `updated_at`
- **Obsługiwane zdarzenia**: brak.
- **Walidacja**: brak.
- **Typy**:
  - `updatedAt?: string | null`
- **Propsy**:
  - `updatedAt?: string | null`

### `UserPreferencesForm`

- **Opis**: Reużywalny formularz (ten sam w onboardingu i edycji profilu), tutaj w trybie „full”.
  - Rekomendacja: użyć `react-hook-form` + `@hookform/resolvers/zod` i komponentów z `src/components/ui/form.tsx` dla spójnej a11y i obsługi błędów.
- **Główne elementy**:
  - `<form onSubmit=...>`
  - Fieldsety: alergeny, wykluczenia, dieta, cele
  - `Button` „Zapisz”, `Button` „Anuluj”
  - (opcjonalnie) `Alert` na błąd ogólny
- **Obsługiwane zdarzenia**:
  - `onSubmit` (submit formularza)
  - `onCancel` (klik „Anuluj”)
- **Walidacja**:
  - zgodnie z `userPreferencesCommandSchema` (Zod) + dodatkowy constraint „allergens ⊆ słownik alergenów” (refinement po stronie UI),
  - liczby: parsowanie/normalizacja do `number | null` (bez wysyłania `NaN`).
- **Typy**:
  - `UserPreferencesFormValues` (RHF)
  - `UpsertUserPreferencesCommand` (payload do API)
- **Propsy**:
  - `mode: 'full' | 'onboarding'` (w tym widoku zawsze `'full'`)
  - `defaultValues: UserPreferencesFormValues`
  - `isSaving: boolean`
  - `onSubmit: (cmd: UpsertUserPreferencesCommand) => Promise<void> | void`
  - `onCancel: () => void`
  - `apiError?: { code?: string; message: string } | null`

### `AllergensFieldset`

- **Opis**: Wybór alergenów w formie checkboxów (multi-select). Lista opcji jest pobierana ze słownika alergenów w bazie.
- **Główne elementy**:
  - `<fieldset>`
  - `<legend>` (np. „Alergeny”)
  - lista checkboxów (label + input), ułożona responsywnie (grid)
  - (opcjonalnie) opis pomocniczy (np. „Wybierz alergeny, których chcesz unikać.”)
- **Obsługiwane zdarzenia**:
  - `onToggle(allergenKey)` (RHF Controller / `FormField`)
- **Walidacja**:
  - każdy element musi istnieć w pobranej liście aktywnych alergenów,
  - UI nie zakłada „14” na sztywno — to wynika z danych (słownik powinien być zasiany 14 alergenami UE).
- **Typy**:
  - `AllergenKey`, `AllergenOptionVM`
- **Propsy**:
  - `options: AllergenOptionVM[]`
  - `value: AllergenKey[]`
  - `onChange: (next: AllergenKey[]) => void`
  - `disabled?: boolean`

### `ExclusionsFieldset`

- **Opis**: Lista wykluczeń (np. składniki, których użytkownik nie chce) jako „tag input”.
- **Główne elementy**:
  - `<fieldset>`
  - lista aktualnych tagów (`Badge` + przycisk usuń)
  - `Input` do dodawania + `Button` „Dodaj” (opcjonalnie)
- **Obsługiwane zdarzenia**:
  - `onAdd(text)` (Enter / klik)
  - `onRemove(index | value)`
  - `onClearAll()` (opcjonalnie)
- **Walidacja**:
  - trim, min 1, max 100 znaków,
  - max 200 pozycji,
  - deduplikacja case-insensitive (np. „Papryka” i „papryka” → jedno),
  - blokada dodania pustego/za długiego wpisu + inline komunikat.
- **Typy**:
  - `string[]` (wartość pola)
- **Propsy**:
  - `value: string[]`
  - `onChange: (next: string[]) => void`
  - `disabled?: boolean`

### `DietFieldset`

- **Opis**: Wybór diety (pojedynczy wybór) + możliwość ustawienia „brak” (`null`).
- **Główne elementy**:
  - `<fieldset>`
  - `Select` (shadcn) lub radio list (a11y: łatwiejsze)
  - opcja „Brak / Nie ustawiono”
- **Obsługiwane zdarzenia**:
  - `onChange(diet | null)`
- **Walidacja**:
  - `null` albo string 1–50 po trim.
- **Typy**:
  - `DietKey` (VM) + mapowanie na string dla API
- **Propsy**:
  - `options: DietOptionVM[]`
  - `value: DietKey | null`
  - `onChange: (next: DietKey | null) => void`
  - `disabled?: boolean`

### `TargetsFieldset`

- **Opis**: Opcjonalne ustawienia celu kalorycznego i bazowej liczby porcji.
- **Główne elementy**:
  - `<fieldset>`
  - `Input type="number"` dla kalorii i porcji
  - opisy pomocnicze (np. „Używane jako domyślne parametry w AI / skalowaniu.”)
- **Obsługiwane zdarzenia**:
  - `onChangeTargetCalories(number|null)`
  - `onChangeTargetServings(number|null)`
- **Walidacja**:
  - `null` lub int dodatni,
  - nie wysyłać `NaN`,
  - wartości skrajne: UI może clampować (np. kalorie do rozsądnego limitu), ale minimalnie spełnić wymaganie „positive int”.
- **Typy**:
  - `number | null`
- **Propsy**:
  - `targetCalories: number | null`
  - `targetServings: number | null`
  - `onChange: (patch: { target_calories?: number | null; target_servings?: number | null }) => void`
  - `disabled?: boolean`

### `UserPreferencesEditStates` (loading/error/unauthorized)

- **Opis**: Spójne renderowanie stanów pobierania i błędów.
- **Główne elementy**:
  - `Skeleton` w loading
  - `Alert` (destructive) w error + `Button` „Spróbuj ponownie”
  - w unauthorized: komunikat + CTA do logowania (jeśli/ kiedy będzie widok `/login`)
- **Obsługiwane zdarzenia**:
  - `onRetry()`
- **Walidacja**: brak.
- **Typy**:
  - `ApiMappedError` (z warstwy API)
  - `UserPreferencesViewState`
- **Propsy**:
  - `state: UserPreferencesViewState`
  - `onRetry: () => void`

## 5. Typy

### Istniejące typy (z `src/types.ts`)

- **`UserPreferencesDTO`**:
  - pola z tabeli `user_preferences` + mapowanie JSON → `string[]`:
    - `id: UUID`
    - `user_id: UUID`
    - `allergens: string[]`
    - `exclusions: string[]`
    - `diet: string | null`
    - `target_calories: number | null`
    - `target_servings: number | null`
    - `created_at: ISODateString`
    - `updated_at: ISODateString`
- **`UpsertUserPreferencesCommand`** (payload do `PUT /api/user/preferences`):
  - `allergens: string[]`
  - `exclusions: string[]`
  - `diet: string | null`
  - `target_calories: number | null`
  - `target_servings: number | null`
- **`ApiSuccess<T>`**, **`ApiError`**: koperty odpowiedzi i błędów.

### Nowe typy (ViewModel / UI)

#### `type AllergenKey` i `type AllergenOptionVM`

Wartości alergenów w preferencjach są przechowywane jako stringi. Aby nie hardcodować listy 14 UE w UI, źródłem prawdy jest słownik alergenów w bazie, pobierany przez API.

```ts
type AllergenKey = string

type AllergenOptionVM = {
  id: string
  name: string
  label: string
  is_active: boolean
}
```

Mapowanie:
- `name`/`label` bazuje na `AllergenDictionaryDTO.allergen_name` (np. `label` może być wersją „ładną” do UI).
- W `UserPreferencesDTO.allergens` zapisujemy `name` (czyli `allergen_name`), nie ID.

#### `type DietKey` i `type DietOptionVM`

W UI trzymamy enum diet (spójny z istniejącymi tagami w `RecipeMetaEditor`):

```ts
type DietKey = 'vegan' | 'vegetarian' | 'gluten_free' | 'keto' | 'high_protein'

type DietOptionVM = {
  key: DietKey
  label: string
}
```

Mapowanie do API: `diet: DietKey | null` → `diet: string | null` (identyczna wartość string).

#### `type UserPreferencesFormValues`

Rekomendowane jako wartości formularza (RHF):

```ts
type UserPreferencesFormValues = {
  allergens: AllergenKey[]
  exclusions: string[]
  diet: DietKey | null
  target_calories: number | null
  target_servings: number | null
}
```

#### `type UserPreferencesFieldErrorsVM`

```ts
type UserPreferencesFieldErrorsVM = Partial<{
  allergens: string
  exclusions: string
  diet: string
  target_calories: string
  target_servings: string
}>
```

Źródła:
- błędy Zod po stronie klienta,
- `fieldErrors` z API (`ApiError.error.fieldErrors`) mapowane na pola formularza.

#### `type UserPreferencesViewState`

```ts
type UserPreferencesViewState =
  | { status: 'loading' }
  | { status: 'ready'; data: { dto: import('@/types').UserPreferencesDTO | null } }
  | { status: 'not_found' } // GET 404: brak preferencji (pierwsze użycie)
  | { status: 'unauthorized' } // 401
  | { status: 'error'; error: { code?: string; message: string } }
```

## 6. Zarządzanie stanem

Wystarczający jest stan lokalny w `UserPreferencesEditPage`:

- **Stan ładowania danych**:
  - `viewState: UserPreferencesViewState`
  - `dto` (z GET) lub `null` dla 404
- **Stan zapisu**:
  - `isSaving: boolean`
  - `apiError: { code?: string; message: string } | null`
- **Stan formularza**:
  - rekomendacja: `react-hook-form` przechowuje wartości i błędy pól,
  - `defaultValues` ustawiane na podstawie DTO lub wartości pustych (w przypadku 404).

### Proponowane custom hooki

#### `useAbortableFetch()` (już istnieje)

Użyć do pobierania preferencji tak, aby:
- kolejne odświeżenia anulowały poprzednie requesty,
- unikać race conditions przy szybkiej nawigacji.

#### `useSupabaseAccessToken()` (nowy, mały hook)

- **Cel**: pobrać access token z `supabaseClient.auth.getSession()` po stronie klienta.
- **Zachowanie**:
  - jeśli brak sesji → stan `unauthorized`,
  - jeśli jest token → udostępnić go do warstwy API.

## 7. Integracja API

### Endpointy

- `GET /api/user/preferences`
  - **200**: `ApiSuccess<UserPreferencesDTO>`
  - **404**: `ApiError` (`NOT_FOUND`) — preferencje jeszcze nie istnieją
  - **401**: `ApiError` (`UNAUTHORIZED`)
  - **500/429**: `ApiError`
- `PUT /api/user/preferences`
  - **Request body**: `UpsertUserPreferencesCommand`
  - **200**: `ApiSuccess<UserPreferencesDTO>`
  - **400**: `ApiError` z `fieldErrors` (w aktualnej implementacji backendu walidacja zwraca 400, nie 422)
  - **401/500/429**: `ApiError`

### Słownik alergenów (źródło opcji UI)

Widok potrzebuje listy aktywnych alergenów do wyrenderowania checkboxów i walidacji „tylko wartości ze słownika”.

W repo istnieją endpointy adminowe oparte o `src/lib/services/allergens.service.ts`:
- `GET /api/admin/allergens` (wymaga admin; query m.in. `is_active`, `page`, `page_size`, `sort`, `order`)

Rekomendacja dla widoku użytkownika:
- dodać **read-only** endpoint do odczytu słownika dla zalogowanego użytkownika (bez uprawnień admin), np.:
  - `GET /api/allergens?is_active=true`
  - implementacja może reużyć `listAllergens()` i `listAllergensQuerySchema` (z limitami, np. `page=1&page_size=50&sort=name&order=asc`)

Jeśli produktowo endpoint adminowy ma być używany również w UI użytkownika, to należy:
- zdjąć/zmienić `requireAdmin` **dla samego GET** (read-only) albo wystawić osobny endpoint read-only (bezpieczniejsze).

### Nagłówki autoryzacji

Endpoint `/api/user/preferences` wymaga uwierzytelnienia:
- cookie-based session (SSR), lub
- `Authorization: Bearer <access_token>`

### Warstwa API po stronie frontendu (propozycja pliku)

Dodać `src/lib/api/user-preferences.ts`:
- `getUserPreferences(accessToken: string, signal?: AbortSignal): Promise<{ data: UserPreferencesDTO }>`
- `putUserPreferences(accessToken: string, cmd: UpsertUserPreferencesCommand): Promise<{ data: UserPreferencesDTO }>`
- wspólny typ błędu (analogicznie do `src/lib/api/recipes.ts`):
  - `ApiMappedError = { code?: string; message: string; fieldErrors?: Record<string, string[]> }`
- mapowanie błędów:
  - tolerować zarówno `400` jak i `422` jako „błędy walidacji” (defensywnie, bo plan API wspomina 422).

Dodać `src/lib/api/allergens.ts` (lub analogicznie):
- `listAllergens(accessToken: string, params: { is_active: true }, signal?: AbortSignal): Promise<{ data: import('@/types').AllergenDictionaryDTO[]; meta?: import('@/types').ApiListMeta }>`
- w UI w widoku `/profile/edit` wykorzystywać `allergen_name` jako `AllergenKey` i `is_active` do filtrowania (UI powinien i tak prosić o `is_active=true`).

## 8. Interakcje użytkownika

- **Wejście na `/profile/edit`**:
  - pokazanie skeletonu
  - pobranie tokena z Supabase session
  - równolegle:
    - `GET /api/user/preferences`
    - `GET /api/allergens?is_active=true` (lub równoważny endpoint read-only na słownik)
  - zachowanie:
    - 200 (preferences): wypełnienie formularza
    - 404 (preferences): pusty formularz (pierwsza konfiguracja) + informacja „Nie masz jeszcze zapisanych preferencji”
    - 401: komunikat + CTA do logowania
- **Zaznaczanie alergenów**:
  - klik checkboxa dodaje/usuwa wartość w `allergens`
  - UI może pokazywać licznik (np. „Wybrano: 3” albo „3 z 14”, jeśli słownik faktycznie ma 14 aktywnych pozycji)
- **Dodawanie wykluczeń**:
  - wpis + Enter/klik „Dodaj” → dodanie tagu, jeśli poprawny i nie jest duplikatem
  - klik „x” na tagu → usunięcie
- **Wybór diety**:
  - wybór z listy lub ustawienie „Brak”
- **Ustawienia kalorii/porcji**:
  - wpis liczby lub wyczyszczenie pola (→ `null`)
- **Zapis**:
  - `PUT /api/user/preferences` z payloadem
  - sukces: komunikat „Zapisano” + aktualizacja `updated_at` w nagłówku
  - błąd walidacji: błędy inline na polach
  - błąd ogólny: `Alert`/toast
- **Anuluj**:
  - nawigacja do bezpiecznego miejsca (np. `/recipes`) lub `history.back()` (zależnie od konwencji projektu).

## 9. Warunki i walidacja

### Warunki weryfikowane przez UI (przed wysłaniem do API)

- **Spójność listy alergenów (słownik z bazy)**:
  - tylko wartości istniejące w pobranych (aktywnych) wpisach słownika,
  - jeśli słownik się nie załadował: zablokować submit (preferowane) albo pozwolić zapisać z ostrzeżeniem i polegać na walidacji serwera (mniej UX-friendly).
- **Wykluczenia**:
  - trim + brak pustych elementów
  - max 100 znaków per element
  - max 200 elementów
  - deduplikacja case-insensitive
- **Dieta**:
  - `null` albo jedna z opcji `DietKey`
- **Cele**:
  - `null` albo dodatnie int
  - `target_servings` dodatkowo sensowna górna granica UI (np. 20) — opcjonalnie, by ograniczyć pomyłki.

### Jak walidacja wpływa na UI

- Błędy pól:
  - wyświetlane pod polem przez `FormMessage` (RHF) lub tekst `text-destructive`.
- `Zapisz`:
  - disabled, gdy `isSaving=true`,
  - (opcjonalnie) disabled, gdy formularz jest niezmieniony (`isDirty=false`) — UX dla trybu „full”.

## 10. Obsługa błędów

Scenariusze i zalecane zachowanie:

- **401 UNAUTHORIZED** (brak/wygaśnięty token):
  - stan `unauthorized`,
  - komunikat: „Zaloguj się, aby edytować preferencje.”
  - CTA: przejście do `/login` (jeśli istnieje) lub placeholder.
- **404 NOT_FOUND** na GET:
  - traktować jako „pierwsza konfiguracja”,
  - formularz startuje z wartościami domyślnymi (puste listy, `diet=null`, cele `null`),
  - zapis realizować przez `PUT` (upsert).
- **400/422 Validation failed** na PUT:
  - mapować `fieldErrors` na pola (np. `target_calories`, `target_servings`, `diet`, `allergens`, `exclusions`),
  - pokazać komunikat ogólny „Popraw błędy w formularzu”.
- **429 RATE_LIMIT** (middleware globalny):
  - banner/alert: „Za dużo żądań — spróbuj ponownie za chwilę.”
  - brak automatycznych retry w pętli; retry tylko na akcję użytkownika.
- **500 INTERNAL** / błędy sieci:
  - `Alert` z przyciskiem „Spróbuj ponownie” (dla GET) lub „Spróbuj zapisać ponownie” (dla PUT),
  - logowanie do `console.error` (bez PII).

## 11. Kroki implementacji

1. **Dodać stronę routingu**: utworzyć `src/pages/profile/edit.astro` analogicznie do `src/pages/recipes/new.astro` i zamontować komponent React z `client:load`.
2. **Dodać komponent kontenera**: utworzyć `src/components/user-preferences/UserPreferencesEditPage.tsx` (lub analogiczna nazwa zgodna z konwencją projektu).
3. **Dodać stałe słowników UI**:
   - `DIET_OPTIONS: DietOptionVM[]` (spójne z `RecipeMetaEditor`)
4. **Dodać typy ViewModel**:
   - `AllergenKey`, `AllergenOptionVM`, `DietKey`, `UserPreferencesFormValues`, `UserPreferencesViewState`.
5. **Dodać (lub wykorzystać) endpoint read-only na słownik alergenów**:
   - preferowane: `GET /api/allergens?is_active=true` (re-use `allergens.service.ts`)
   - alternatywnie: dostosować `GET /api/admin/allergens` tak, by dało się go bezpiecznie używać w UI użytkownika (read-only).
6. **Dodać warstwę API**:
   - `src/lib/api/user-preferences.ts` (`getUserPreferences`, `putUserPreferences`)
   - `src/lib/api/allergens.ts` (`listAllergens`)
7. **Dodać pozyskanie tokena**:
   - mały hook `useSupabaseAccessToken()` (wewnątrz komponentu lub jako osobny plik) używający `supabaseClient.auth.getSession()`.
8. **Zaimplementować pobieranie danych**:
   - w `useEffect`: token → równolegle pobrać preferences + listę alergenów,
   - obsłużyć 200/404/401/500 i odpowiednio ustawić `viewState` oraz stan opcji alergenów.
9. **Zaimplementować formularz**:
   - `UserPreferencesForm` z RHF + Zod:
     - baza: `userPreferencesCommandSchema` z `src/lib/validation/user-preferences.ts`,
     - rozszerzenie o refinement „allergens ⊆ fetched dictionary”.
10. **Zaimplementować zapis**:
   - `PUT /api/user/preferences` z nagłówkiem Authorization,
   - mapować `fieldErrors` do błędów formularza,
   - po sukcesie: odświeżyć `updated_at` (np. przez użycie DTO z response).
11. **Dodać a11y i UX detale**:
   - poprawne `fieldset/legend`, etykiety, focus na pierwszym błędzie po submit,
   - disable przycisków podczas `isSaving`,
   - czytelne komunikaty błędów.
12. **Testy manualne (checklista)**:
   - brak sesji → 401/unauthorized state,
   - GET 404 → pusty formularz + zapis przez PUT,
   - słownik alergenów: ładuje się poprawnie; UI blokuje submit, jeśli słownik nie jest dostępny (wg przyjętej decyzji),
   - walidacja: puste/niepoprawne liczby, duplikaty wykluczeń, próba dodania pustego tagu,
   - 429 (sztucznie, np. szybkie odświeżenia) → banner i brak pętli retry,
   - refresh strony po zapisaniu → wartości wczytują się poprawnie.

