# API Endpoint Implementation Plan: POST /api/admin/allergens

## 1. Przegląd punktu końcowego
Endpoint administracyjny do tworzenia nowych wpisów w słowniku alergenów. Zapisuje rekord w `allergen_dictionary` oraz tworzy wpis audytowy `created` w `allergen_dictionary_audit`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/admin/allergens`
- Parametry:
  - Wymagane: brak parametrów w URL/query
  - Opcjonalne: brak parametrów w URL/query
- Request Body:
  - `allergen_name` (string, wymagane, max 100)
  - `synonyms` (string[], wymagane; może być pusta tablica)
  - `is_active` (boolean, wymagane)

## 3. Wykorzystywane typy
- DTO:
  - `AllergenDictionaryDTO` (odpowiedź)
  - `AllergenDictionaryAuditDTO` (pośrednio, audyt)
- Command:
  - `CreateAllergenCommand` (wejście)
- Envelopes:
  - `ApiSuccess<AllergenDictionaryDTO>`
  - `ApiError`

## 3. Szczegóły odpowiedzi
- 201 Created:
  - Body: `ApiSuccess<AllergenDictionaryDTO>`
- 400 Bad Request:
  - Nieprawidłowe dane wejściowe (np. pusta nazwa, błędny typ, zbyt długie pole)
- 401 Unauthorized:
  - Brak autoryzacji lub sesji użytkownika
- 500 Internal Server Error:
  - Błąd po stronie serwera / bazy
- Konflikty:
  - 409 Conflict: zduplikowana nazwa alergenu (unique constraint)
  - Jeśli wymagane ograniczenie do 400/401/404/500, mapować konflikt do 400 z kodem domenowym `DUPLICATE_ALLERGEN_NAME`

## 4. Przepływ danych
1. API route `src/pages/api/admin/allergens/index.ts` przyjmuje żądanie POST.
2. Pobranie `supabase` z `context.locals` oraz identyfikatora użytkownika (autoryzacja admin).
3. Walidacja payloadu z użyciem Zod (patrz sekcja walidacji).
4. Wywołanie `createAllergen` z `src/lib/services/allergens.service.ts`.
5. Serwis zapisuje rekord w `allergen_dictionary`, mapuje DTO.
6. Serwis tworzy wpis audytowy w `allergen_dictionary_audit` (best-effort, loguje błąd).
7. Zwrócenie `201` i `ApiSuccess<AllergenDictionaryDTO>`.

## 5. Względy bezpieczeństwa
- Uwierzytelnienie: wymagane aktywne konto (Supabase auth).
- Autoryzacja: tylko admin (sprawdzenie roli/claimów w sesji).
- Walidacja danych wejściowych Zod przed zapisem do bazy.
- Ochrona przed nadużyciami:
  - limitowanie częstotliwości (opcjonalnie middleware),
  - odrzucanie nadmiernie długich pól.
- Używać `context.locals.supabase` zgodnie z zasadami backend.

## 6. Obsługa błędów
- 400: błędny payload (Zod), błędny typ danych, puste wymagane pola.
- 401: brak sesji lub brak uprawnień admin.
- 409: duplikat `allergen_name` (db code `23505`).
- 500: nieoczekiwany błąd DB lub runtime.
- Logowanie:
  - Jeśli brak dedykowanej tabeli błędów, logować przez `console.error` z metadanymi (request id, user id, payload).
  - Audyt jest best‑effort; jego błąd nie blokuje 201.

## 7. Wydajność
- Jeden insert do `allergen_dictionary` + jeden insert do `allergen_dictionary_audit`.
- Indeksy na `allergen_name` zapewniają szybkie wykrywanie duplikatów.
- Payload mały, brak kosztownych zapytań.

## 8. Kroki implementacji
1. Utworzyć/uzupełnić route `src/pages/api/admin/allergens/index.ts` z handlerem `POST` i `export const prerender = false`.
2. Dodać walidację Zod:
   - `allergen_name`: `z.string().min(1).max(100).trim()`
   - `synonyms`: `z.array(z.string().min(1).max(100).trim()).default([])`
   - `is_active`: `z.boolean()`
3. Pobierać `supabase` z `context.locals`, zidentyfikować użytkownika i rolę admin.
4. Wywołać `createAllergen(supabase, userId, cmd)` z istniejącego serwisu `src/lib/services/allergens.service.ts`.
5. Mapować błędy serwisu na `ApiError`:
   - `DUPLICATE_ALLERGEN_NAME` → 409 (lub 400 jeśli wymagane)
   - brak autoryzacji → 401
   - pozostałe → 500
6. Zwrócić `ApiSuccess<AllergenDictionaryDTO>` z kodem 201.
7. Dodać testy (jeśli projekt je posiada):
   - poprawne utworzenie,
   - walidacja Zod,
   - konflikt duplikatu,
   - brak autoryzacji.
