# Specyfikacja architektury modułu rejestracji, logowania i odzyskiwania hasła (Supabase Auth + Astro SSR)

Dokument opisuje docelową architekturę (bez implementacji) modułu **rejestracji i logowania**, **wylogowania (US-003)**, **ograniczenia prób logowania (US-004)** oraz **usuwania konta i danych (US-005)**, wraz z odzyskiwaniem hasła, zgodnie z `@.ai/prd.md` i stackiem z `@.ai/tech-stack.md`.

Uwzględnia obecny stan aplikacji:
- Aplikacja jest SSR (`astro.config.mjs`: `output: "server"`, adapter Node standalone).
- API już używa Supabase i posiada konwencję błędów `ApiError { error: { code, message, fieldErrors? } }`.
- Część endpointów ma dziś **tryb kompatybilności dev**: gdy brak tokenu, używany jest `DEFAULT_USER_ID` i klient service-role (bypass RLS). Ta specyfikacja **nie narusza** tego zachowania – proponuje kontrolowane wygaszanie poprzez flagę środowiskową.

---

## 0. Cele i założenia

### 0.1 Cele funkcjonalne
- **Rejestracja e‑mailem** (PRD 3.1, US-001) – minimalny zestaw danych (email + hasło), zgodność z minimalizacją PII.
- **Logowanie e‑mailem** (PRD 3.1, US-002).
- **Wylogowanie** (US-003): widoczny przycisk; po wylogowaniu sesja unieważniona i wrażliwy cache lokalny wyczyszczony.
- **Rate limit logowania** (US-004): 5 prób / 5 minut / IP, blokada do końca okna, komunikat z pozostałym czasem, monitoring i alarmowanie nieudanych prób.
- **Usunięcie konta i danych** (US-005): dostępna akcja „Usuń konto” z potwierdzeniem; konto natychmiast traci dostęp, a dane są trwale usuwane zgodnie z polityką retencji (PRD 3.12, do 12 miesięcy) lub wcześniej na żądanie.
- **Odzyskiwanie hasła**: standardowy flow Supabase (email reset + ustawienie nowego hasła).

### 0.2 Założenia niefunkcjonalne i bezpieczeństwo (PRD 3.1 + 3.12)
- Wymuszenie HTTPS w środowiskach produkcyjnych; cookies i sesje zabezpieczone.
- Brak ujawniania szczegółów (np. czy email istnieje) w komunikatach błędów logowania i resetu hasła.
- Prywatność danych: przepisy i preferencje widoczne wyłącznie dla właściciela (RLS).
  - Minimalizacja PII w telemetrii auth: IP i user-agent przechowywać wyłącznie w zakresie niezbędnym do egzekwowania limitów i monitoringu; preferować krótką retencję (np. okno + bufor) lub hashowanie/anonymizację w logach analitycznych.

### 0.3 Kluczowa decyzja architektoniczna: SSR + cookies (Supabase)
Docelowo sesja Supabase powinna być dostępna **po stronie serwera** (guardy SSR, redirecty, ochrona stron). Wymaga to przejścia na **cookie-based session** (zamiast polegania wyłącznie na `localStorage`).

Rekomendowany wariant (zgodny z aktualnymi zaleceniami Supabase dla SSR):
- użycie `@supabase/ssr` (server client + obsługa cookies) razem z `@supabase/supabase-js`.

---

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 1.1 Strony Astro (routing, SSR guardy, integracja z backendem)

#### 1.1.1 Nowe strony dla trybu non-auth (publiczne)
Proponowane ścieżki:
- `src/pages/auth/login.astro`
- `src/pages/auth/register.astro`
- `src/pages/auth/forgot-password.astro`
- `src/pages/auth/reset-password.astro` (ustawienie nowego hasła po wejściu z linka)
- (opcjonalnie) `src/pages/auth/callback.astro` – jeśli wykorzystamy flow PKCE/magic link i potrzebujemy dedykowanego callbacka

Odpowiedzialności strony Astro:
- Renderowanie szkieletu (layout, meta title).
- **SSR redirect** na podstawie stanu sesji:
  - jeśli użytkownik jest zalogowany → nie pokazujemy login/register, tylko redirect do `/recipes` (lub do `returnTo`).
  - jeśli użytkownik niezalogowany → dostęp do login/register/forgot/reset.
- Przekazanie do React formularza tylko niezbędnych danych (np. `returnTo`, ewentualnie `prefillEmail`).

#### 1.1.2 Strony Astro w trybie auth (chronione)
Istniejące strony (dziś działają bez twardego auth):
- `src/pages/recipes/index.astro`
- `src/pages/recipes/new.astro`
- `src/pages/recipes/[id].astro`
- `src/pages/recipes/[id]/edit.astro`
- `src/pages/profile/edit.astro`

Docelowe zachowanie (produkcja):
- SSR guard: jeśli brak sesji → redirect do `/auth/login?returnTo=<aktualna_ścieżka>`.

Tryb kompatybilności (dev / migracyjny):
- jeśli brak sesji, ale ustawiona flaga `AUTH_MODE=compat` (lub `AUTH_REQUIRED=false`) → strona pozostaje dostępna jak dziś; API może korzystać z `DEFAULT_USER_ID`.

**Wskazanie SSR/prerender**: dla stron chronionych i auth stron należy jawnie ustawić `export const prerender = false`, aby nie doszło do statycznego wygenerowania stron w buildach.

#### 1.1.3 Ustawienia konta (US-005)
Wymóg PRD: użytkownik może wykonać akcję „Usuń konto” z potwierdzeniem.

Proponowane miejsce w UI:
- w `src/pages/profile/edit.astro` (sekcja „Konto”) lub jako osobna strona `src/pages/profile/settings.astro`.

Zachowanie UX:
- akcja jest widoczna tylko w trybie zalogowanym,
- wymagane potwierdzenie (np. modal z przyciskiem destrukcyjnym),
- po zleceniu usunięcia: natychmiastowe wylogowanie + informacja, że konto zostało oznaczone do usunięcia (lub usunięte, jeśli wdrożymy natychmiastowe czyszczenie).

### 1.2 Layouty i nawigacja (auth vs non-auth)

Aktualnie `src/layouts/Layout.astro` jest minimalistyczny (HTML + `<slot/>`) i strony same budują `<main>`.

Proponowane rozszerzenie bez psucia istniejących stron:
- Zachować `Layout.astro` jako bazę (nie zmieniać kontraktu slotu).
- Dodać dwa nowe layouty:
  - `src/layouts/PublicLayout.astro` (dla `/auth/*`):
    - prosty, bez elementów wymagających sesji,
    - linki: „Zaloguj”, „Załóż konto”, „Nie pamiętam hasła”.
  - `src/layouts/AppLayout.astro` (dla `/recipes/*`, `/profile/*`):
    - header z nawigacją i akcjami użytkownika,
    - po prawej: avatar/email + dropdown z „Profil” i „Wyloguj”.

Proponowane komponenty UI (React, shadcn/ui) używane przez layout:
- `src/components/auth/AppHeader.tsx` (client:load)
  - pobiera stan sesji (z cookie SSR – wstępny stan z Astro props + późniejsze odświeżanie w React),
  - pokazuje:
    - w trybie auth: menu + przycisk „Wyloguj”
    - w trybie non-auth: linki do logowania/rejestracji
- `src/components/auth/UserMenu.tsx` (dropdown)
- `src/components/auth/LogoutButton.tsx` (logika wylogowania + czyszczenie cache)

### 1.3 Rozdzielenie odpowiedzialności: Astro vs React

#### 1.3.1 Astro (server-side)
- Ustalenie „czy użytkownik jest zalogowany” na podstawie cookies sesji Supabase.
- Wykonanie redirectów przed renderem strony (guardy).
- Przekazanie do komponentów React:
  - `initialSession` (opcjonalnie),
  - `initialUser` (opcjonalnie: `{ id, email }`),
  - `returnTo`.

#### 1.3.2 React (client-side)
- Formularze i interakcje:
  - walidacja pól,
  - wysyłka żądań do endpointów auth (patrz rozdział 2),
  - obsługa stanów ładowania i błędów,
  - UX countdown dla blokady (US-004).
- Reakcja na zmianę sesji:
  - po login/register: przekierowanie do `returnTo` albo `/recipes`,
  - po logout: przekierowanie do `/auth/login`.
- Czyszczenie cache po wylogowaniu:
  - usunięcie ewentualnych danych w `localStorage`/`sessionStorage` związanych z UI,
  - reset stanów w pamięci (React state),
  - (opcjonalnie, jeśli wdrożone) czyszczenie cache PWA/Service Worker dla zasobów wrażliwych.

### 1.4 Formularze i komponenty auth (React)

#### 1.4.1 Nowe komponenty
Proponowane pliki (w oparciu o istniejący styl projektu: React + react-hook-form + zod):
- `src/components/auth/LoginPage.tsx`
- `src/components/auth/RegisterPage.tsx`
- `src/components/auth/ForgotPasswordPage.tsx`
- `src/components/auth/ResetPasswordPage.tsx`

Wspólne komponenty:
- `src/components/auth/AuthCard.tsx` (kontener)
- `src/components/auth/AuthFormField.tsx` (pole z etykietą, error text)
- `src/components/auth/RateLimitAlert.tsx` (komunikat US-004 z pozostałym czasem)

#### 1.4.2 Walidacja i komunikaty błędów (UI)
Walidacja client-side powinna być spójna z walidacją backendu (Zod).

**Login (`/auth/login`)**
- pola: `email`, `password`
- walidacja:
  - email: format + required
  - hasło: required (bez ujawniania polityki, jeśli nie jest zdefiniowana w PRD)
- błędy:
  - `INVALID_CREDENTIALS`: „Nieprawidłowy email lub hasło.”
  - `RATE_LIMITED`: „Zbyt wiele prób logowania. Spróbuj ponownie za X min Y s.”
  - `NETWORK`: „Nie udało się połączyć z serwerem. Spróbuj ponownie.”

**Register (`/auth/register`)**
- pola: `email`, `password`, `confirmPassword`
- walidacja:
  - email: format + required
  - hasło: minimalna długość (np. 8) + required
  - confirmPassword: musi pasować
- błędy:
  - `EMAIL_TAKEN` (jeśli ujawniamy): lepiej komunikat neutralny: „Nie udało się utworzyć konta.”
  - `WEAK_PASSWORD`: „Hasło jest zbyt słabe.” (jeśli Supabase zwraca taki sygnał)

**Forgot password (`/auth/forgot-password`)**
- pole: `email`
- odpowiedź zawsze „OK” z neutralnym komunikatem (nie ujawniamy, czy konto istnieje):
  - „Jeśli konto istnieje, wyślemy link do resetu hasła.”

**Reset password (`/auth/reset-password`)**
- pola: `password`, `confirmPassword`
- błędy:
  - `INVALID_OR_EXPIRED_LINK`: „Link wygasł. Poproś o nowy.”
  - `WEAK_PASSWORD`: „Hasło jest zbyt słabe.”

### 1.5 Najważniejsze scenariusze (end-to-end)

#### 1.5.1 Logowanie z przekierowaniem (happy path)
1. Użytkownik wchodzi na `/recipes`.
2. SSR guard wykrywa brak sesji → redirect do `/auth/login?returnTo=/recipes`.
3. Użytkownik loguje się.
4. Po sukcesie:
   - sesja zapisuje się w cookies (SSR-ready),
   - redirect do `returnTo`.

#### 1.5.2 US-004: limit prób logowania + komunikat z czasem
1. Użytkownik 5× podaje błędne dane.
2. Backend zwraca `429 RATE_LIMITED` z `retry_after_seconds`.
3. UI pokazuje countdown i blokuje przycisk „Zaloguj” do czasu odblokowania.

#### 1.5.3 US-003: wylogowanie + czyszczenie cache
1. Użytkownik klika „Wyloguj” w menu.
2. Sesja Supabase jest unieważniana, cookies usuwane.
3. UI czyści wrażliwe dane i przekierowuje do `/auth/login`.

#### 1.5.4 Reset hasła
1. Użytkownik na `/auth/forgot-password` prosi o link.
2. Otwiera link z emaila → trafia na `/auth/reset-password` (z parametrami Supabase).
3. Ustawia nowe hasło → redirect do `/auth/login` (lub auto-login, jeśli UX tak przewiduje).

---

## 2. LOGIKA BACKENDOWA

### 2.1 Struktura endpointów API (Astro `src/pages/api`)

Docelowo warto rozdzielić auth od reszty API w `src/pages/api/auth/*`:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password` (opcjonalnie – jeśli robimy ustawienie hasła przez backend; alternatywnie bezpośrednio Supabase w przeglądarce)
- `POST /api/auth/delete-account` (US-005) – zlecenie usunięcia konta i danych
- (opcjonalnie) `GET /api/auth/me` – szybkie pobranie użytkownika dla UI

Uzasadnienie: umożliwia spełnienie US-004 (własny rate limit z czasem blokady) oraz spójne logowanie zdarzeń i błędów.

### 2.2 Kontrakty request/response (spójne z `ApiError`)

#### 2.2.1 `POST /api/auth/login`
Request:
- `{ email: string; password: string }`

Response 200:
- `{ data: { user: { id: string; email: string | null } } }`

Response 401 (`INVALID_CREDENTIALS`):
- `{ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }`

Response 429 (`RATE_LIMITED`):
- `{ error: { code: 'RATE_LIMITED', message: 'Too many login attempts', retry_after_seconds: number } }`
  - `retry_after_seconds` jest kluczowy dla UX US-004.

#### 2.2.2 `POST /api/auth/register`
Request:
- `{ email: string; password: string }`

Response 201/200:
- `{ data: { user: { id: string; email: string | null } } }`

Ważne: po rejestracji należy utworzyć:
- wpis w `public.users` (id = auth user id),
- „pusty” profil `public.user_preferences` (US-001/PRD 3.2).

#### 2.2.3 `POST /api/auth/logout`
Response 204:
- bez body

#### 2.2.4 `POST /api/auth/forgot-password`
Request:
- `{ email: string }`

Response 200:
- `{ data: { ok: true } }` (zawsze, neutralnie)

#### 2.2.5 `GET /api/auth/me` (opcjonalnie)
Response 200:
- `{ data: { user: { id: string; email: string | null } | null } }`

#### 2.2.6 `POST /api/auth/delete-account` (US-005)
Cel: umożliwić użytkownikowi zlecenie trwałego usunięcia konta i danych.

Request:
- `{ confirm: true }` (jawne potwierdzenie, aby utrudnić przypadkowe wywołania)

Response 202:
- `{ data: { state: 'deletion_scheduled' } }`

Response 401:
- `{ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }`

Uwagi:
- Endpoint powinien natychmiast:
  - unieważnić sesję (logout) i uniemożliwić dalsze użycie konta (np. `users.is_active=false`, `users.deleted_at=now()` lub równoważny znacznik),
  - zlecić usuwanie danych użytkownika (purge) w tle lub wykonać je od razu (jeśli gotowe).
- Trwałe usunięcie danych powinno nastąpić zgodnie z polityką retencji (PRD 3.12) – nie później niż w 12 miesięcy; dopuszczalne jest wcześniejsze usunięcie „na żądanie”.

### 2.3 Mechanizm walidacji danych wejściowych

Zgodnie z istniejącym podejściem (np. `src/lib/validation/*`):
- Zod schema per endpoint:
  - `src/lib/validation/auth.ts`:
    - `loginCommandSchema`
    - `registerCommandSchema`
    - `forgotPasswordCommandSchema`
    - `resetPasswordCommandSchema` (jeśli dotyczy)
- Na błędzie walidacji:
  - status `400`,
  - `ApiError.error.fieldErrors` z `zodError.flatten().fieldErrors`.

### 2.4 US-004: rate limiting logowania (5 prób / 5 min / IP)

#### 2.4.1 Źródło prawdy: tabela `login_attempts` + config w `system_config`
W schemacie DB istnieją:
- `login_attempts(ip_address, email, success, failure_reason, user_agent, created_at)`
- `system_config` z kluczami:
  - `rate_limit_attempts = 5`
  - `rate_limit_window_minutes = 5`

Docelowy algorytm blokady na endpointzie `/api/auth/login`:
- dla danego IP (z `context.clientAddress`), policz **nieudane** próby w oknie \(now - 5min, now\)
- jeśli liczba nieudanych prób >= 5:
  - zwróć `429 RATE_LIMITED`
  - oblicz `retry_after_seconds` jako: `(oldestFailureInWindow + window) - now`, zaokrąglone w górę do sekundy
- w przeciwnym wypadku:
  - wykonaj próbę logowania w Supabase Auth,
  - zapisz do `login_attempts` wynik (success/failure + reason),
  - na sukcesie: opcjonalnie aktualizuj `users.last_login_at`.

Uwagi produkcyjne:
- Minimalizacja PII: jeśli przechowujemy IP w `login_attempts` dla egzekwowania limitu, utrzymywać krótką retencję (co najmniej zgodną z oknem limitu, z małym buforem) i unikać kopiowania pełnego IP do długotrwałych logów analitycznych; w `analytics_logs` preferować hashowanie/anonymizację IP.

#### 2.4.2 Monitoring i alarmowanie
Wymóg: „Zdarzenia nieudanych logowań są monitorowane i alarmowane.”

Proponowana realizacja:
- każdy `login_attempts.success=false` → wpis do `analytics_logs` (`action='AuthLoginFailed'`, `status=<reason>`, `metadata={ ip, userAgent, emailHash? }`)
- alerting (poza kodem aplikacji) na podstawie metryk:
  - wiele blokad z jednego IP,
  - wzrost `AuthLoginFailed`,
  - częste `RATE_LIMITED`.

### 2.5 Obsługa wyjątków (API)

Standard:
- zawsze zwracamy JSON z `Content-Type: application/json` (poza 204),
- logujemy `console.error(...)` w API przy `INTERNAL`,
- nie zwracamy surowych błędów Supabase na frontend.

Mapowanie błędów:
- błędny JSON → `400 BAD_REQUEST (Invalid JSON)`
- walidacja → `400 BAD_REQUEST (Validation failed + fieldErrors)`
- błędne dane logowania → `401 UNAUTHORIZED` (komunikat ogólny)
- blokada rate limit → `429 RATE_LIMITED + retry_after_seconds`
- problemy z Supabase → `500 INTERNAL`

### 2.6 Aktualizacja sposobu renderowania stron server-side (Astro SSR)

#### 2.6.1 Middleware (jedno miejsce odpowiedzialności)
Obecny middleware (`src/middleware/index.ts`) ustawia `context.locals.supabase = supabaseClient` i ma globalny rate limit `/api/*`.

Docelowo middleware powinien:
- nadal utrzymać globalny rate limit `/api/*` (bez zmian – nie psuje istniejących zachowań),
- dodatkowo tworzyć **server-side Supabase client** oparty o cookies (SSR),
- wystawiać go w `context.locals.supabase` (lub równolegle `supabaseServer`), aby:
  - strony `.astro` mogły robić SSR guardy,
  - endpointy `/api/*` mogły czytać sesję z cookies bez wymogu `Authorization` header.

#### 2.6.2 Kompatybilność z obecnym trybem „bez auth”
W części endpointów istnieje fallback:
- brak `Authorization` → `getSupabaseServiceRoleClient()` + `DEFAULT_USER_ID`.

Docelowy plan utrzymania kompatybilności:
- dodać zmienną środowiskową, np.:
  - `AUTH_REQUIRED=true|false` (lub `AUTH_MODE=compat|strict`)
- w trybie `compat`:
  - endpointy nadal mogą używać `DEFAULT_USER_ID`, aby nie blokować rozwoju UI
- w trybie `strict` (produkcja):
  - brak sesji/cookies/tokenu → `401 UNAUTHORIZED`
  - wyłączyć użycie service-role dla endpointów użytkownika (poza admin i wewnętrznymi operacjami).

---

## 3. SYSTEM AUTENTYKACJI (Supabase Auth + Astro)

### 3.1 Supabase Auth – przepływy i odpowiedzialności

#### 3.1.1 Rejestracja
- Supabase: `signUp({ email, password })`
- Po sukcesie:
  - utworzenie rekordu w `public.users` (id = `auth.users.id`, email = `auth.users.email`)
  - utworzenie rekordu w `public.user_preferences` z wartościami domyślnymi
- Redirect po rejestracji:
  - do onboardingu `/profile/edit` (PRD 3.2/US-010), z soft-gate w AI (poza zakresem tej specyfikacji, ale interfejs powinien kierować użytkownika do uzupełnienia profilu).

#### 3.1.2 Logowanie
- Supabase: `signInWithPassword({ email, password })`
- US-004: przed wywołaniem Supabase sprawdzenie blokady per IP (patrz 2.4).

#### 3.1.3 Wylogowanie (US-003)
- Supabase: `signOut()`
- Dodatkowo (frontend):
  - czyścimy wrażliwe dane w pamięci i w storage,
  - przekierowanie do `/auth/login`.

#### 3.1.4 Odzyskiwanie hasła
Rekomendowany flow Supabase:
- `resetPasswordForEmail(email, { redirectTo: '<origin>/auth/reset-password' })`
- użytkownik ustawia nowe hasło po powrocie do aplikacji.

### 3.2 Sesja i cookies (SSR)

#### 3.2.1 Docelowy model sesji
- Sesja przechowywana w **bezpiecznych cookies** (httpOnly tam gdzie to możliwe, `secure` w prod, `sameSite=lax`).
- Server-side (Astro) ma dostęp do sesji i może wykonywać redirecty.
- Client-side (React) nadal może subskrybować zmiany sesji i reagować na logout/expiry.

#### 3.2.2 Konsekwencje dla API (bez łamania obecnych kontraktów)
Docelowo endpointy API powinny akceptować dwa warianty autoryzacji:
- **preferowany (browser)**: cookie-based session (SSR-friendly)
- **alternatywny**: `Authorization: Bearer <access_token>` (przydatny np. dla testów, narzędzi, potencjalnych klientów mobilnych)

To pozwala:
- nie wymuszać natychmiastowej przeróbki wszystkich wywołań `fetch()` w front-end,
- stopniowo przechodzić na „strict auth” bez regresji.

### 3.3 Dane i RLS

#### 3.3.1 Prywatność danych (RLS)
W bazie RLS jest już włączone na kluczowych tabelach (`users`, `user_preferences`, `recipes`, itd.) z politykami `auth.uid() = user_id`.

Wymagane konsekwencje:
- w produkcji endpointy użytkownika muszą działać na kliencie anon-key z prawidłową sesją (RLS egzekwuje prywatność),
- service-role jest dozwolony wyłącznie dla:
  - endpointów admin,
  - operacji systemowych, które nie mogą być wykonane z RLS (np. synchronizacja `public.users` po rejestracji).

#### 3.3.2 Synchronizacja `public.users`
Aplikacja już dziś ma logikę „ensure user exists in public.users” (przykład w `/api/recipes`).

Docelowo dla spójności:
- przenieść tę odpowiedzialność do etapu **rejestracji** (zamiast „ratować się” przy pierwszym użyciu `/api/recipes`),
- zachować „self-healing” jako fallback (nie psuje istniejących danych), ale traktować jako mechanizm awaryjny.

### 3.4 Spójność z istniejącą autoryzacją admin
W kodzie istnieje `src/lib/auth.ts: requireAdmin()` sprawdzający rolę w `app_metadata/user_metadata`.

Specyfika:
- rola `admin` powinna być nadawana po stronie Supabase (panel/skrpt), nie w UI.
- endpointy admin nadal powinny wymagać:
  - sesji użytkownika + roli `admin`,
  - oraz mogą używać service-role do operacji DB, ale tylko po udanej autoryzacji.

Dodatkowy wymóg z PRD (3.9):
- UI panelu admin i endpointy admin (mutacje) powinny być dodatkowo gated przez **feature flagę** (np. zmienna środowiskowa `ADMIN_FEATURE_ENABLED=true` albo odczyt z `system_config`) niezależnie od roli.

---

## 4. Minimalny zakres zmian w istniejących modułach (bez implementacji)

### 4.1 Frontend
- Dodać strony `.astro` pod `/auth/*` i podpiąć do nich React formularze (`client:load`).
- Dodać layouty `PublicLayout.astro` i `AppLayout.astro` (lub alternatywnie rozbudować obecny `Layout.astro` w sposób nieinwazyjny).
- Dodać komponent „Wyloguj” dostępny z UI (US-003).
- Dodać mechanizm prezentacji blokady i czasu (US-004) w UI logowania.

### 4.2 Backend
- Dodać endpointy `/api/auth/*` z walidacją Zod i spójnymi błędami.
- Dodać logowanie prób logowania do `login_attempts` i (opcjonalnie) `analytics_logs`.
- Zaktualizować middleware do obsługi Supabase SSR client (cookies) i przejściowego trybu `AUTH_MODE`.

---

## 5. Kryteria akceptacji zgodne z PRD (mapowanie)

- **US-003**:
  - „Widoczny przycisk wylogowania” → `AppHeader/UserMenu` + `LogoutButton`.
  - „Sesja unieważniona i cache lokalny czyszczony” → signOut + czyszczenie storage/cache + redirect.

- **US-004**:
  - „Limit 5 prób/5 min/IP” → `login_attempts` + okno czasowe.
  - „Blokada do resetu okna czasowego” → `429` do czasu wygaśnięcia.
  - „Komunikat z pozostałym czasem” → `retry_after_seconds` + countdown w UI.
  - „Monitorowane i alarmowane” → `login_attempts` + `analytics_logs` + alerty infrastruktury.

- **US-005**:
  - „Akcja ‘Usuń konto’ z potwierdzeniem” → UI w profilu/ustawieniach + `POST /api/auth/delete-account` z `{ confirm: true }`.
  - „Dane oznaczane do usunięcia i trwale usuwane zgodnie z retencją (do 12 miesięcy) lub na żądanie” → natychmiastowe odebranie dostępu + mechanizm purge (asynchroniczny lub natychmiastowy) z gwarancją maksymalnego czasu usunięcia.

