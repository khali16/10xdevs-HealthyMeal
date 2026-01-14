# API Endpoint Implementation Plan: Allergen Dictionary (Admin)

## 1. Przegląd punktu końcowego

Ten plan obejmuje implementację pięciu endpointów API związanych z zarządzaniem słownikiem alergenów przez administratorów:

1. **GET /api/admin/allergens** - Listowanie wpisów słownika alergenów z filtrowaniem i paginacją
2. **POST /api/admin/allergens** - Tworzenie nowego wpisu alergenu z automatycznym zapisem audytu
3. **PATCH /api/admin/allergens/{id}** - Aktualizacja wpisu alergenu z zapisem audytu
4. **DELETE /api/admin/allergens/{id}** - Usunięcie (soft delete/deaktywacja) wpisu z zapisem audytu
5. **GET /api/admin/allergens/{id}/audit** - Listowanie wpisów audytu dla danego alergenu

Wszystkie endpointy wymagają uprawnień administratora (`role=admin` w JWT) i wykorzystują service-role klienta Supabase do operacji na bazie danych, omijając RLS (Row Level Security). Operacje mutacyjne (POST, PATCH, DELETE) automatycznie zapisują wpisy audytu w tabeli `allergen_dictionary_audit`.

## 2. Szczegóły żądania

### 2.1 GET /api/admin/allergens

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/admin/allergens`
- **Parametry query**:
  - **Opcjonalne**:
    - `is_active` (boolean): filtrowanie po statusie aktywności
    - `q` (string): wyszukiwanie tekstowe po nazwie alergenu lub synonimach (ILIKE)
    - `page` (number, default: 1): numer strony
    - `page_size` (number, default: 20, max: 100): rozmiar strony
    - `sort` (string, default: "name"): sortowanie (`name`, `created_at`, `updated_at`)
    - `order` (string, default: "asc"): kierunek sortowania (`asc`, `desc`)
- **Request Body**: Brak
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane, z `role=admin`)

### 2.2 POST /api/admin/allergens

- **Metoda HTTP**: POST
- **Struktura URL**: `/api/admin/allergens`
- **Parametry**: Brak
- **Request Body**: `CreateAllergenCommand`
  ```json
  {
    "allergen_name": "gluten",
    "synonyms": ["pszenica", "żyto"],
    "is_active": true
  }
  ```
  - `allergen_name` (wymagane, string, max 100 znaków): unikalna nazwa alergenu
  - `synonyms` (wymagane, string[]): tablica synonimów
  - `is_active` (wymagane, boolean): status aktywności
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane, z `role=admin`)
  - `Content-Type: application/json`
  - `Idempotency-Key` (opcjonalne): klucz idempotentności dla bezpiecznych retry

### 2.3 PATCH /api/admin/allergens/{id}

- **Metoda HTTP**: PATCH
- **Struktura URL**: `/api/admin/allergens/{id}`
- **Parametry**:
  - **Wymagane**: `id` (UUID alergenu w ścieżce URL)
- **Request Body**: `PatchAllergenCommand` (wszystkie pola opcjonalne)
  ```json
  {
    "allergen_name": "gluten updated",
    "synonyms": ["pszenica", "żyto", "jęczmień"],
    "is_active": false
  }
  ```
  - `allergen_name` (opcjonalne, string, max 100 znaków): nazwa alergenu
  - `synonyms` (opcjonalne, string[]): tablica synonimów (full-replace)
  - `is_active` (opcjonalne, boolean): status aktywności
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane, z `role=admin`)
  - `Content-Type: application/json`

### 2.4 DELETE /api/admin/allergens/{id}

- **Metoda HTTP**: DELETE
- **Struktura URL**: `/api/admin/allergens/{id}`
- **Parametry**:
  - **Wymagane**: `id` (UUID alergenu w ścieżce URL)
- **Request Body**: Brak
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane, z `role=admin`)

### 2.5 GET /api/admin/allergens/{id}/audit

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/admin/allergens/{id}/audit`
- **Parametry**:
  - **Wymagane**: `id` (UUID alergenu w ścieżce URL)
- **Parametry query**:
  - **Opcjonalne**:
    - `page` (number, default: 1): numer strony
    - `page_size` (number, default: 20, max: 100): rozmiar strony
    - `sort` (string, default: "changed_at"): sortowanie (`changed_at`, `action`)
    - `order` (string, default: "desc"): kierunek sortowania (`asc`, `desc`)
- **Request Body**: Brak
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>` (wymagane, z `role=admin`)

## 3. Wykorzystywane typy

### 3.1 DTOs (z `src/types.ts`)

```typescript
export type AllergenDictionaryDTO = Omit<
  AllergenDictionaryRow,
  'synonyms'
> & {
  synonyms: string[]
}

export type AllergenDictionaryAuditDTO = Omit<
  AllergenDictionaryAuditRow,
  'old_values' | 'new_values'
> & {
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}
```

### 3.2 Command Modele (z `src/types.ts`)

```typescript
export type CreateAllergenCommand = {
  allergen_name: string
  synonyms: string[]
  is_active: boolean
}

export type PatchAllergenCommand = Partial<
  Pick<CreateAllergenCommand, 'allergen_name' | 'synonyms' | 'is_active'>
>
```

### 3.3 Response Envelopes (z `src/types.ts`)

```typescript
export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
export type ApiListSuccess<T> = { data: T[]; meta: ApiListMeta }
export type ApiError = {
  error: {
    code: string
    message: string
    details?: unknown
    fieldErrors?: Record<string, string[]>
  }
}

export type ApiListMeta = {
  page: number
  page_size: number
  total?: number
  has_next: boolean
}
```

### 3.4 Row Types (z `src/db/database.types.ts`)

```typescript
export type AllergenDictionaryRow = Tables<'allergen_dictionary'>
export type AllergenDictionaryAuditRow = Tables<'allergen_dictionary_audit'>
```

## 4. Szczegóły odpowiedzi

### 4.1 GET /api/admin/allergens

- **200 OK**: `ApiListSuccess<AllergenDictionaryDTO>`
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "allergen_name": "gluten",
        "synonyms": ["pszenica", "żyto"],
        "is_active": true,
        "created_at": "2025-01-21T10:00:00Z",
        "updated_at": "2025-01-21T10:00:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "page_size": 20,
      "total": 50,
      "has_next": true
    }
  }
  ```
- **401 Unauthorized**: `ApiError` - brak lub nieprawidłowy token JWT
- **403 Forbidden**: `ApiError` - brak uprawnień administratora
- **500 Internal Server Error**: `ApiError` - nieoczekiwany błąd serwera

### 4.2 POST /api/admin/allergens

- **201 Created**: `ApiSuccess<AllergenDictionaryDTO>` + nagłówek `Location: /api/admin/allergens/{id}`
  ```json
  {
    "data": {
      "id": "uuid",
      "allergen_name": "gluten",
      "synonyms": ["pszenica", "żyto"],
      "is_active": true,
      "created_at": "2025-01-21T10:00:00Z",
      "updated_at": "2025-01-21T10:00:00Z"
    }
  }
  ```
- **400 Bad Request**: `ApiError` - niepoprawny JSON
- **401 Unauthorized**: `ApiError` - brak lub nieprawidłowy token JWT
- **403 Forbidden**: `ApiError` - brak uprawnień administratora
- **409 Conflict**: `ApiError` - duplikat nazwy alergenu
  ```json
  {
    "error": {
      "code": "DUPLICATE_ALLERGEN_NAME",
      "message": "Allergen with this name already exists"
    }
  }
  ```
- **422 Unprocessable Entity**: `ApiError` - błędy walidacji z `fieldErrors`
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "fieldErrors": {
        "allergen_name": ["Allergen name is required", "Allergen name must be at most 100 characters"],
        "synonyms": ["Synonyms must be an array"]
      }
    }
  }
  ```
- **500 Internal Server Error**: `ApiError` - nieoczekiwany błąd serwera

### 4.3 PATCH /api/admin/allergens/{id}

- **200 OK**: `ApiSuccess<AllergenDictionaryDTO>`
  ```json
  {
    "data": {
      "id": "uuid",
      "allergen_name": "gluten updated",
      "synonyms": ["pszenica", "żyto", "jęczmień"],
      "is_active": false,
      "created_at": "2025-01-21T10:00:00Z",
      "updated_at": "2025-01-21T11:00:00Z"
    }
  }
  ```
- **400 Bad Request**: `ApiError` - niepoprawny JSON
- **401 Unauthorized**: `ApiError` - brak lub nieprawidłowy token JWT
- **403 Forbidden**: `ApiError` - brak uprawnień administratora
- **404 Not Found**: `ApiError` - alergen o podanym ID nie istnieje
  ```json
  {
    "error": {
      "code": "ALLERGEN_NOT_FOUND",
      "message": "Allergen not found"
    }
  }
  ```
- **409 Conflict**: `ApiError` - próba zmiany nazwy na już istniejącą
- **422 Unprocessable Entity**: `ApiError` - błędy walidacji z `fieldErrors`
- **500 Internal Server Error**: `ApiError` - nieoczekiwany błąd serwera

### 4.4 DELETE /api/admin/allergens/{id}

- **204 No Content**: Brak treści odpowiedzi
- **401 Unauthorized**: `ApiError` - brak lub nieprawidłowy token JWT
- **403 Forbidden**: `ApiError` - brak uprawnień administratora
- **404 Not Found**: `ApiError` - alergen o podanym ID nie istnieje
- **500 Internal Server Error**: `ApiError` - nieoczekiwany błąd serwera

### 4.5 GET /api/admin/allergens/{id}/audit

- **200 OK**: `ApiListSuccess<AllergenDictionaryAuditDTO>`
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "allergen_id": "uuid",
        "action": "created",
        "old_values": null,
        "new_values": {
          "allergen_name": "gluten",
          "synonyms": ["pszenica", "żyto"],
          "is_active": true
        },
        "changed_by": "uuid",
        "changed_at": "2025-01-21T10:00:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "page_size": 20,
      "total": 5,
      "has_next": false
    }
  }
  ```
- **401 Unauthorized**: `ApiError` - brak lub nieprawidłowy token JWT
- **403 Forbidden**: `ApiError` - brak uprawnień administratora
- **404 Not Found**: `ApiError` - alergen o podanym ID nie istnieje
- **500 Internal Server Error**: `ApiError` - nieoczekiwany błąd serwera

## 5. Przepływ danych

### 5.1 GET /api/admin/allergens

1. Klient wysyła `GET /api/admin/allergens` z opcjonalnymi parametrami query
2. Middleware weryfikuje JWT token i sprawdza uprawnienia administratora (`role=admin`)
3. Jeśli brak autoryzacji → zwraca 401/403
4. Handler `GET`:
   - Parsuje parametry query (paginacja, filtrowanie, sortowanie)
   - Waliduje parametry (page ≥ 1, page_size 1-100, sort enum, order enum)
   - Tworzy service-role klienta Supabase
   - Buduje zapytanie z filtrami:
     - `is_active`: filtrowanie po kolumnie `is_active`
     - `q`: ILIKE na `allergen_name` lub sprawdzenie w `synonyms` (JSONB GIN index)
   - Wykonuje zapytanie z paginacją i sortowaniem
   - Liczy całkowitą liczbę wyników (dla `total` w meta)
   - Mapuje wiersze na `AllergenDictionaryDTO` (konwersja JSONB `synonyms` na `string[]`)
   - Zwraca 200 z `ApiListSuccess<AllergenDictionaryDTO>`

### 5.2 POST /api/admin/allergens

1. Klient wysyła `POST /api/admin/allergens` z `CreateAllergenCommand` w body
2. Middleware weryfikuje JWT token i sprawdza uprawnienia administratora
3. Jeśli brak autoryzacji → zwraca 401/403
4. Handler `POST`:
   - Parsuje JSON z body (obsługa błędów 400 dla niepoprawnego JSON)
   - Waliduje payload za pomocą Zod:
     - `allergen_name`: string, wymagane, max 100 znaków, trim
     - `synonyms`: array of strings, wymagane, niepuste
     - `is_active`: boolean, wymagane
   - Jeśli walidacja nie powiedzie się → zwraca 422 z `fieldErrors`
   - Pobiera `userId` z JWT tokena (`user.id`)
   - Tworzy service-role klienta Supabase
   - Sprawdza unikalność `allergen_name` (opcjonalnie, baza zwróci 409)
   - Wykonuje transakcję:
     - Wstawia rekord do `allergen_dictionary`:
       - `allergen_name`: z commanda
       - `synonyms`: konwersja `string[]` na JSONB
       - `is_active`: z commanda
     - Wstawia rekord audytu do `allergen_dictionary_audit`:
       - `allergen_id`: ID nowo utworzonego alergenu
       - `action`: `'created'`
       - `old_values`: `null`
       - `new_values`: JSONB z pełnymi danymi alergenu
       - `changed_by`: `userId`
   - Jeśli błąd unikalności → zwraca 409
   - Mapuje wiersz na `AllergenDictionaryDTO`
   - Zwraca 201 z `ApiSuccess<AllergenDictionaryDTO>` + nagłówek `Location`

### 5.3 PATCH /api/admin/allergens/{id}

1. Klient wysyła `PATCH /api/admin/allergens/{id}` z `PatchAllergenCommand` w body
2. Middleware weryfikuje JWT token i sprawdza uprawnienia administratora
3. Jeśli brak autoryzacji → zwraca 401/403
4. Handler `PATCH`:
   - Parsuje `id` z parametrów ścieżki (walidacja UUID)
   - Parsuje JSON z body
   - Waliduje payload za pomocą Zod (wszystkie pola opcjonalne, ale jeśli podane, to z odpowiednimi ograniczeniami)
   - Jeśli walidacja nie powiedzie się → zwraca 422 z `fieldErrors`
   - Pobiera `userId` z JWT tokena
   - Tworzy service-role klienta Supabase
   - Pobiera istniejący rekord alergenu (jeśli nie istnieje → 404)
   - Jeśli `allergen_name` jest zmieniane, sprawdza unikalność (opcjonalnie)
   - Wykonuje transakcję:
     - Aktualizuje rekord w `allergen_dictionary`:
       - Tylko podane pola są aktualizowane (partial update)
       - `synonyms`: full-replace (jeśli podane)
       - `updated_at`: automatycznie ustawiane przez trigger DB lub ręcznie
     - Wstawia rekord audytu:
       - `allergen_id`: ID alergenu
       - `action`: `'updated'`
       - `old_values`: JSONB z poprzednimi wartościami (tylko zmienione pola)
       - `new_values`: JSONB z nowymi wartościami (tylko zmienione pola)
       - `changed_by`: `userId`
   - Jeśli błąd unikalności → zwraca 409
   - Mapuje zaktualizowany wiersz na `AllergenDictionaryDTO`
   - Zwraca 200 z `ApiSuccess<AllergenDictionaryDTO>`

### 5.4 DELETE /api/admin/allergens/{id}

1. Klient wysyła `DELETE /api/admin/allergens/{id}`
2. Middleware weryfikuje JWT token i sprawdza uprawnienia administratora
3. Jeśli brak autoryzacji → zwraca 401/403
4. Handler `DELETE`:
   - Parsuje `id` z parametrów ścieżki (walidacja UUID)
   - Pobiera `userId` z JWT tokena
   - Tworzy service-role klienta Supabase
   - Pobiera istniejący rekord alergenu (jeśli nie istnieje → 404)
   - Wykonuje transakcję:
     - Opcja A (soft delete): Ustawia `is_active = false` w `allergen_dictionary`
     - Opcja B (hard delete): Usuwa rekord z `allergen_dictionary` (CASCADE usunie audyt)
     - **Zalecenie**: Użyj soft delete (`is_active = false`) dla zachowania historii
     - Wstawia rekord audytu:
       - `allergen_id`: ID alergenu
       - `action`: `'deleted'`
       - `old_values`: JSONB z pełnymi danymi przed usunięciem
       - `new_values`: `null` (lub `{ "is_active": false }` dla soft delete)
       - `changed_by`: `userId`
   - Zwraca 204 No Content

### 5.5 GET /api/admin/allergens/{id}/audit

1. Klient wysyła `GET /api/admin/allergens/{id}/audit` z opcjonalnymi parametrami query
2. Middleware weryfikuje JWT token i sprawdza uprawnienia administratora
3. Jeśli brak autoryzacji → zwraca 401/403
4. Handler `GET`:
   - Parsuje `id` z parametrów ścieżki (walidacja UUID)
   - Parsuje parametry query (paginacja, sortowanie)
   - Waliduje parametry
   - Tworzy service-role klienta Supabase
   - Sprawdza istnienie alergenu (jeśli nie istnieje → 404)
   - Wykonuje zapytanie do `allergen_dictionary_audit`:
     - Filtruje po `allergen_id = id`
     - Sortuje po `changed_at` (domyślnie DESC) lub `action`
     - Stosuje paginację
   - Liczy całkowitą liczbę wyników
   - Mapuje wiersze na `AllergenDictionaryAuditDTO` (konwersja JSONB na `Record<string, unknown>`)
   - Zwraca 200 z `ApiListSuccess<AllergenDictionaryAuditDTO>`

## 6. Względy bezpieczeństwa

### 6.1 Uwierzytelnianie i autoryzacja

- **Wymagane**: Wszystkie endpointy wymagają autoryzacji przez Bearer JWT token
- **Weryfikacja tokena**: Użycie `supabase.auth.getUser()` do weryfikacji tokena i pobrania `user_id`
- **Sprawdzenie roli**: Weryfikacja claim `role=admin` w JWT tokenie
- **Brak autoryzacji**: Zwracanie 401 z komunikatem `{ "error": { "code": "UNAUTHORIZED", "message": "Unauthorized" } }`
- **Brak uprawnień**: Zwracanie 403 z komunikatem `{ "error": { "code": "FORBIDDEN", "message": "Admin access required" } }`
- **Feature flag**: Dodatkowa weryfikacja feature flag dla admin UI (jeśli zaimplementowana)

### 6.2 Service-Role Client

- **Bypass RLS**: Wszystkie operacje na `allergen_dictionary` i `allergen_dictionary_audit` używają service-role klienta Supabase
- **Tworzenie klienta**: 
  ```typescript
  const supabaseServiceRole = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  )
  ```
- **Bezpieczeństwo**: Service-role key NIGDY nie jest eksponowany do klienta, tylko używany server-side
- **Ograniczenie dostępu**: Service-role klient używany TYLKO w handlerach admin endpointów

### 6.3 Walidacja danych wejściowych

- **Zod schemas**: Walidacja wszystkich danych wejściowych za pomocą schematów Zod
- **UUID validation**: Walidacja formatu UUID dla `id` w ścieżce
- **String constraints**: 
  - `allergen_name`: max 100 znaków (zgodnie z DB schema), trim whitespace
  - `synonyms`: array of strings, każdy element max rozsądnej długości
- **Type safety**: Wykorzystanie TypeScript do zapewnienia bezpieczeństwa typów
- **SQL injection**: Ochrona przez parametryzowane zapytania Supabase (nie używamy raw SQL)

### 6.4 Ochrona przed nadużyciami

- **Rate limiting**: Middleware zapewnia globalny limit 120 requestów/min/IP dla autentykowanych żądań
- **Idempotency**: Wsparcie dla nagłówka `Idempotency-Key` w POST (opcjonalne, ale zalecane)
- **Origin/Referer validation**: Walidacja `Origin`/`Referer` dla admin mutations (zgodnie z api-plan.md)
- **Payload size**: Middleware ogranicza rozmiar JSON body do 256KB

### 6.5 Audit Logging

- **Niezmienność**: Wpisy audytu są tylko do odczytu (nie można ich modyfikować ani usuwać przez API)
- **Kompletność**: Każda operacja mutacyjna (create/update/delete) zapisuje pełny audit trail
- **Identyfikacja**: Każdy wpis audytu zawiera `changed_by` (UUID użytkownika wykonującego operację)
- **Timestamp**: Automatyczne ustawianie `changed_at` przez bazę danych

## 7. Obsługa błędów

### 7.1 Błędy walidacji (422)

- **Przyczyna**: Nieprawidłowe dane wejściowe (np. zbyt długa nazwa, puste synonimy)
- **Odpowiedź**: 422 z `ApiError` zawierającym `fieldErrors`
- **Przykład**:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "fieldErrors": {
        "allergen_name": ["Allergen name is required", "Allergen name must be at most 100 characters"],
        "synonyms": ["Synonyms must be a non-empty array"]
      }
    }
  }
  ```

### 7.2 Błędy autoryzacji (401, 403)

- **401 Unauthorized**: Brak tokena JWT lub nieprawidłowy token
  ```json
  {
    "error": {
      "code": "UNAUTHORIZED",
      "message": "Unauthorized"
    }
  }
  ```
- **403 Forbidden**: Token prawidłowy, ale brak uprawnień administratora
  ```json
  {
    "error": {
      "code": "FORBIDDEN",
      "message": "Admin access required"
    }
  }
  ```

### 7.3 Błędy zasobów (404, 409)

- **404 Not Found**: Alergen o podanym ID nie istnieje
  ```json
  {
    "error": {
      "code": "ALLERGEN_NOT_FOUND",
      "message": "Allergen not found"
    }
  }
  ```
- **409 Conflict**: Próba utworzenia alergenu z już istniejącą nazwą
  ```json
  {
    "error": {
      "code": "DUPLICATE_ALLERGEN_NAME",
      "message": "Allergen with this name already exists"
    }
  }
  ```

### 7.4 Błędy serwera (500)

- **Przyczyna**: Nieoczekiwane błędy (błąd bazy danych, błąd parsowania, itp.)
- **Odpowiedź**: 500 z ogólnym komunikatem błędu (bez szczegółów technicznych dla klienta)
- **Logowanie**: Pełne szczegóły błędu logowane server-side
- **Przykład**:
  ```json
  {
    "error": {
      "code": "INTERNAL_SERVER_ERROR",
      "message": "An unexpected error occurred"
    }
  }
  ```

### 7.5 Mapowanie błędów bazy danych

- **Unique constraint violation** → 409 Conflict
- **Foreign key violation** → 404 Not Found (jeśli dotyczy alergenu) lub 400 Bad Request
- **Check constraint violation** → 422 Unprocessable Entity
- **Connection/timeout errors** → 500 Internal Server Error

## 8. Rozważania dotyczące wydajności

### 8.1 Indeksy bazy danych

- **Wykorzystanie istniejących indeksów**:
  - `idx_allergen_dictionary_name`: dla filtrowania i sprawdzania unikalności
  - `idx_allergen_dictionary_is_active`: dla filtrowania po `is_active`
  - `idx_allergen_dictionary_synonyms` (GIN): dla wyszukiwania tekstowego w synonimach
  - `idx_allergen_audit_allergen_id`: dla zapytań audytu po `allergen_id`
  - `idx_allergen_audit_changed_at`: dla sortowania audytu

### 8.2 Optymalizacja zapytań

- **Paginacja**: Zawsze używaj `LIMIT` i `OFFSET` dla list endpointów
- **Count queries**: Dla `total` w meta, rozważ oszacowanie zamiast dokładnego liczenia (dla dużych zbiorów danych)
- **Wyszukiwanie tekstowe**: 
  - Dla `q` parameter: użyj GIN index na `synonyms` dla szybkiego wyszukiwania
  - Fallback na ILIKE dla `allergen_name` jeśli GIN nie wystarcza
- **Eager loading**: Nie dotyczy (brak relacji do eager load)

### 8.3 Caching

- **GET endpoints**: Wsparcie dla `ETag`/`If-None-Match` (opcjonalne, zgodnie z api-plan.md)
- **Cache-Control**: `Cache-Control: private, max-age=30` dla list (zgodnie z api-plan.md)
- **Invalidation**: Cache invalidation przy mutacjach (POST/PATCH/DELETE)

### 8.4 Transakcje

- **Atomicity**: Operacje mutacyjne (POST/PATCH/DELETE) używają transakcji dla zapewnienia atomicity między `allergen_dictionary` i `allergen_dictionary_audit`
- **Isolation**: Transakcje zapewniają izolację (zapobieganie race conditions przy sprawdzaniu unikalności)

### 8.5 Potencjalne wąskie gardła

- **Wyszukiwanie w synonimach**: GIN index powinien być wystarczający, ale dla bardzo dużych tablic synonimów może być wolne
- **Count queries**: Dla bardzo dużych tabel, rozważ oszacowanie `total` zamiast dokładnego liczenia
- **Audit queries**: Dla alergenów z dużą historią zmian, paginacja jest krytyczna

## 9. Etapy wdrożenia

### 9.1 Przygotowanie infrastruktury

1. **Utworzenie service-role klienta Supabase**
   - Dodaj `SUPABASE_SERVICE_ROLE_KEY` do zmiennych środowiskowych
   - Utwórz helper function `getSupabaseServiceRoleClient()` w `src/db/supabase.client.ts`
   - Upewnij się, że klucz nie jest eksponowany do klienta

2. **Utworzenie helpera do weryfikacji admin**
   - Utwórz funkcję `requireAdmin(context: APIContext)` w `src/lib/auth.ts` lub podobnym
   - Funkcja powinna:
     - Weryfikować JWT token
     - Sprawdzać claim `role=admin`
     - Zwracać `userId` lub rzucać błąd 401/403

### 9.2 Utworzenie serwisu

3. **Utworzenie `src/lib/services/allergens.service.ts`**
   - Funkcja `listAllergens(supabase: SupabaseClient, filters, pagination)`
   - Funkcja `getAllergenById(supabase: SupabaseClient, id)`
   - Funkcja `createAllergen(supabase: SupabaseClient, userId, cmd, audit)`
   - Funkcja `updateAllergen(supabase: SupabaseClient, userId, id, cmd, audit)`
   - Funkcja `deleteAllergen(supabase: SupabaseClient, userId, id, audit)`
   - Funkcja `getAllergenAudit(supabase: SupabaseClient, allergenId, pagination)`
   - Helper functions do mapowania Row → DTO

### 9.3 Utworzenie walidacji

4. **Utworzenie `src/lib/validation/allergens.ts`**
   - Zod schema dla `CreateAllergenCommand`
   - Zod schema dla `PatchAllergenCommand`
   - Zod schema dla query parameters (paginacja, filtrowanie)

### 9.4 Implementacja endpointów

5. **Utworzenie `src/pages/api/admin/allergens/index.ts`**
   - Handler `GET`: listowanie alergenów
   - Handler `POST`: tworzenie alergenu

6. **Utworzenie `src/pages/api/admin/allergens/[id].ts`**
   - Handler `PATCH`: aktualizacja alergenu
   - Handler `DELETE`: usunięcie alergenu

7. **Utworzenie `src/pages/api/admin/allergens/[id]/audit.ts`**
   - Handler `GET`: listowanie audytu alergenu

### 9.5 Obsługa błędów i mapowanie

8. **Utworzenie helpera do mapowania błędów**
   - Funkcja `mapDbError(error: PostgrestError)` w `src/lib/utils.ts` lub podobnym
   - Mapowanie błędów Supabase na odpowiednie kody HTTP i `ApiError`

### 9.6 Testowanie

9. **Testy jednostkowe**
   - Testy serwisów (mock Supabase client)
   - Testy walidacji

10. **Testy integracyjne**
    - Testy endpointów z rzeczywistą bazą danych (test environment)
    - Testy autoryzacji (401, 403)
    - Testy walidacji (422)
    - Testy błędów (404, 409, 500)

### 9.7 Dokumentacja

11. **Aktualizacja dokumentacji API**
    - Opis endpointów w dokumentacji (jeśli istnieje)
    - Przykłady requestów i odpowiedzi

### 9.8 Optymalizacja i monitoring

12. **Monitoring i logowanie**
    - Logowanie operacji admin (dla audytu)
    - Monitoring błędów (500, rate limits)
    - Metryki wydajności (czas odpowiedzi, użycie indeksów)

## 10. Uwagi implementacyjne

### 10.1 Transakcje i audit

- **Atomicity**: Użyj transakcji Supabase (lub raw SQL z `BEGIN/COMMIT`) dla operacji mutacyjnych, aby zapewnić, że zarówno zmiana w `allergen_dictionary`, jak i wpis audytu są zapisane atomowo
- **Old/New values**: W audycie zapisuj tylko zmienione pola (dla PATCH) lub pełne dane (dla CREATE/DELETE)

### 10.2 Soft delete vs Hard delete

- **Zalecenie**: Użyj soft delete (`is_active = false`) zamiast hard delete dla zachowania historii i możliwości przywrócenia
- **Hard delete**: Jeśli hard delete jest wymagany, pamiętaj że CASCADE usunie również wpisy audytu (jeśli FK ma `ON DELETE CASCADE`)

### 10.3 Idempotency

- **POST endpoint**: Rozważ implementację idempotency key dla POST (opcjonalne, ale zgodne z api-plan.md)
- **Storage**: Przechowuj idempotency keys w pamięci (Map) lub w bazie danych (dla distributed systems)

### 10.4 Wyszukiwanie tekstowe

- **GIN index**: Wykorzystaj GIN index na `synonyms` dla szybkiego wyszukiwania
- **Query**: Użyj `@>` operator dla JSONB lub `?|` dla sprawdzania czy którykolwiek synonim pasuje do wzorca
- **Fallback**: Jeśli GIN nie wystarcza, użyj ILIKE na `allergen_name` i ręczne przeszukanie `synonyms`

### 10.5 Feature Flag

- **Admin UI**: Zgodnie z api-plan.md, admin endpoints powinny być dodatkowo gated przez feature flag
- **Implementacja**: Sprawdź feature flag przed przetwarzaniem żądania (po weryfikacji admin, przed logiką biznesową)

