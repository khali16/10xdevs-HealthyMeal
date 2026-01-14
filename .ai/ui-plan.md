## Architektura UI dla HealthyMeal (MVP)

## 1. Przegląd struktury UI

HealthyMeal to aplikacja web, w której **wszystkie dane (przepisy, preferencje, oceny, ulubione) są prywatne** i dostępne wyłącznie dla właściciela. UI jest zorganizowane wokół:

- **App Shell (po zalogowaniu)**: stały header + treść widoku; domyślny landing po autentykacji to `/recipes`.
- **Główne domeny UI**:
  - **Przepisy**: lista, szczegół, tworzenie/edycja, usuwanie, oceny/ulubione, skalowanie porcji.
  - **AI „Dostosuj”**: modal presetów i parametrów → job z pollingiem → diff view + „dirty guard”.
  - **Preferencje / onboarding**: uzupełnienie profilu z soft gate dla AI.
  - **Admin (feature flag + rola)**: słownik alergenów + audyt.
- **Kontrakt API**: UI zakłada koperty odpowiedzi `{ data, meta }` oraz `{ error: { code, message, details?, fieldErrors? } }`, a także standardowe kody błędów (401/403/404/409/422/429/500/504).
- **Niefunkcjonalne**: responsywność (mobile-first), a11y (klawiatura, focus, ARIA), bezpieczeństwo (guard tras, minimalizacja PII, prywatne cache).

## 2. Lista widoków

Poniżej lista widoków obejmująca wymagania z PRD, plan API oraz notatki z sesji.

### 2.1 Publiczne (przed logowaniem)

#### Widok: Logowanie
- **Ścieżka**: `/login`
- **Główny cel**: umożliwić użytkownikowi zalogowanie się e‑mailem; obsłużyć rate limit i komunikaty błędów bez ujawniania szczegółów.
- **Kluczowe informacje**:
  - stan formularza (email + hasło / link magiczny – zależnie od finalnego auth),
  - komunikaty błędów (w tym 429 z czasem do odblokowania).
- **Kluczowe komponenty widoku**:
  - Formularz logowania (pola + walidacja), `Alert` na błędy, stan „loading”.
  - Link do rejestracji (`/signup`) oraz opcjonalny „zapomniałem hasła”.
- **UX, dostępność i bezpieczeństwo**:
  - a11y: poprawne etykiety pól, czytelne błędy inline, focus na pierwszym błędzie.
  - bezpieczeństwo: brak ujawniania czy email istnieje; obsługa 429 z czytelnym licznikiem; brak logowania wrażliwych danych po stronie klienta.
- **Powiązanie z API**:
  - autentykacja: zgodnie z założeniem „Supabase klientowo”.
  - po sukcesie: `GET /api/me` w celu ustalenia przekierowania (onboarding vs `/recipes`).

#### Widok: Rejestracja
- **Ścieżka**: `/signup`
- **Główny cel**: utworzyć konto minimalnym zestawem danych i przekierować do onboardingu.
- **Kluczowe informacje**: formularz + status utworzenia konta.
- **Kluczowe komponenty**: formularz rejestracji, zgody (jeśli wymagane), `Alert` na błędy.
- **UX/a11y/bezpieczeństwo**:
  - minimalizacja PII, jasna informacja „co i po co”.
  - po sukcesie: automatyczne wejście w onboarding.
- **Powiązanie z API**:
  - po sukcesie: `GET /api/me` oraz przejście do `/onboarding` lub `/profile/edit`.

#### Widok: Strona błędu / nie znaleziono (publiczna)
- **Ścieżka**: `/404` (i fallback routera)
- **Główny cel**: bezpieczny fallback na nieznane trasy.
- **Komponenty**: opis + link „Wróć” / „Przejdź do logowania”.

---

### 2.2 Chronione (po zalogowaniu)

#### Widok: Lista przepisów
- **Ścieżka**: `/recipes`
- **Główny cel**: szybkie przeglądanie i wyszukiwanie własnych przepisów, z filtrami i sortowaniem.
- **Kluczowe informacje**:
  - lista przepisów (karty),
  - aktywne filtry i sort,
  - paginacja,
  - stany: loading/empty/error.
- **Kluczowe komponenty widoku**:
  - Header listy: select sortowania (`newest`, `favorites`, `top_rated`) + przycisk „Nowy przepis”.
  - Filtry: dieta, max kalorie, max czas, ulubione, wyszukiwanie `q` (debounce ~500 ms).
  - Grid kart przepisów (responsywny).
  - Paginacja / „wczytaj więcej”.
  - Szkielety (Skeleton) i komunikaty pustego stanu.
- **UX, dostępność i bezpieczeństwo**:
  - a11y: filtry jako kontrolki formularza z etykietami; widoczny focus; wspierany screen reader.
  - UX: pamiętanie ostatnich filtrów w URL query (shareable + back/forward).
  - bezpieczeństwo: tylko dane użytkownika (RLS); brak wycieku w meta/komunikatach.
- **Powiązanie z API**:
  - `GET /api/recipes` z parametrami: `page`, `page_size`, `diet`, `max_calories`, `max_total_time`, `favorite`, `q`, `sort`.

#### Widok: Szczegóły przepisu
- **Ścieżka**: `/recipes/[id]`
- **Główny cel**: prezentacja przepisu oraz główne akcje: ocena, ulubione, skalowanie porcji, AI „Dostosuj”.
- **Kluczowe informacje**:
  - tytuł, tagi (czas, kalorie, dieta, ocena),
  - składniki i kroki,
  - porcje i pola czasu,
  - status: czy przepis jest AI-adjusted i jego pochodzenie (opcjonalnie).
- **Kluczowe komponenty widoku**:
  - Nagłówek: tytuł + tagi + menu akcji (Edytuj / Usuń).
  - Akcje inline:
    - kontrolka oceny (1–5),
    - toggle „Ulubione”,
    - przycisk „Dostosuj przepis” (otwiera modal).
  - Sekcja „Skalowanie porcji” (prezentacyjna) z „Nie skaluj” per składnik.
  - Sekcje: składniki, kroki, meta (czas/kalorie/porcje).
- **UX, dostępność i bezpieczeństwo**:
  - a11y: kontrolki oceny i toggle jako elementy klikalne z opisami (ARIA), obsługa klawiatury.
  - UX: optymistyczne UI dla ulubionych/oceny z rollbackiem po błędzie.
  - bezpieczeństwo: 404 nie ujawnia czy ID istnieje (RLS maskuje), czytelny fallback.
- **Powiązanie z API**:
  - `GET /api/recipes/{id}`
  - ocena: `PUT /api/recipes/{id}/rating`, usunięcie: `DELETE /api/recipes/{id}/rating`
  - ulubione: `PUT /api/recipes/{id}/favorite` (w tym `favorite=false` jako „odznacz”)
  - usunięcie przepisu: `DELETE /api/recipes/{id}`

#### Widok: Tworzenie przepisu (wizard)
- **Ścieżka**: `/recipes/new`
- **Główny cel**: wklejenie surowego przepisu → zestrukturyzowanie (parsowanie) → korekta → zapis.
- **Kluczowe informacje**:
  - krok aktualny i postęp,
  - surowy tekst oraz wynik parsowania,
  - confidence per pole + ostrzeżenia,
  - walidacje wymaganych pól (tytuł, składniki, kroki).
- **Kluczowe komponenty widoku**:
  - Krok 1: Textarea „Wklej przepis”, podpowiedzi formatowania (np. bullet listy).
  - Krok 2: Podgląd struktury (tytuł / składniki / kroki) z możliwością edycji.
  - Badge z confidence + Alert dla confidence < 0,9 (z możliwością kontynuacji).
  - CTA: „Zapisz” (z ostrzeżeniem, jeśli niskie confidence).
- **UX, dostępność i bezpieczeństwo**:
  - UX: jasna separacja „wklej” vs „edytuj”; komunikat, że dane są prywatne.
  - a11y: poprawny fokus między krokami; komunikaty ostrzeżeń czytelne dla SR.
  - bezpieczeństwo: brak automatycznego zapisu szkicu (zgodnie z PRD), ale możliwy bezpieczny „draft lokalny” tylko jeśli zostanie dopuszczony w przyszłości.
- **Powiązanie z API**:
  - zapis: `POST /api/recipes`
  - zestrukturyzowanie:
    - preferowane w MVP wg notatek: **parsowanie po stronie klienta**
    - alternatywny fallback (jeśli wdrożony): `POST /api/recipes/structure`

#### Widok: Edycja przepisu
- **Ścieżka**: `/recipes/[id]/edit`
- **Główny cel**: edytować przepis i zapisać zmiany (wpływa na `updated_at` i sortowanie).
- **Kluczowe informacje**: aktualne dane przepisu, walidacje pól, stan „dirty”.
- **Kluczowe komponenty**:
  - formularz edycji (tytuł, składniki, kroki, tagi, czasy, porcje, kalorie),
  - opcjonalnie „Ponownie zestrukturyzuj” dla surowego tekstu (jeśli utrzymujemy raw input),
  - `AlertDialog` potwierdzający wyjście przy niezapisanych zmianach (guard).
- **UX/a11y/bezpieczeństwo**:
  - UX: wyraźne CTA „Zapisz” i „Anuluj”; czytelne błędy 422.
  - bezpieczeństwo: PATCH jako jedyny persist edycji; ostrożnie z polami server-managed.
- **Powiązanie z API**:
  - `GET /api/recipes/{id}`
  - `PATCH /api/recipes/{id}`

#### Widok: Onboarding profilu (≤60s)
- **Ścieżka**: `/onboarding` (lub uproszczenie: alias do `/profile/edit?mode=onboarding`)
- **Główny cel**: szybko uzupełnić wymagane preferencje: alergeny (14 UE), wykluczenia, dieta; opcjonalnie kalorie/porcje.
- **Kluczowe informacje**:
  - kompletność profilu (`profile.is_complete`),
  - aktualne wartości preferencji.
- **Kluczowe komponenty**:
  - formularz preferencji:
    - alergeny: multi-select/checkbox listy 14 UE,
    - wykluczenia: lista/tag input,
    - dieta: select,
    - opcjonalnie: target calories / servings.
  - pasek postępu / checklist (żeby zmieścić się w 60 s).
  - CTA: „Zapisz i kontynuuj”.
- **UX, dostępność i bezpieczeństwo**:
  - UX: minimalny czas wypełnienia; sensowne domyślne wartości; autouzupełnianie.
  - a11y: duże cele kliknięcia dla checkboxów; SR-friendly grupy pól.
  - bezpieczeństwo: walidacja alergenów po stronie serwera (422 z fieldErrors).
- **Powiązanie z API**:
  - `GET /api/user/preferences` (może zwrócić 404, wtedy tworzymy)
  - `POST /api/user/preferences` lub `PUT /api/user/preferences` (upsert)
  - `GET /api/me` (do wyświetlenia „is_complete” i ewentualnej analityki)

#### Widok: Edycja profilu preferencji
- **Ścieżka**: `/profile/edit`
- **Główny cel**: zarządzać preferencjami wpływającymi na AI i skalowanie porcji.
- **Kluczowe informacje**: jak w onboardingu + ewentualne „ostatnia aktualizacja”.
- **Komponenty**: ten sam formularz co onboarding, z trybem „pełnym” (bez presji czasu).
- **UX/a11y/bezpieczeństwo**: jak onboarding.
- **Powiązanie z API**:
  - `GET/PUT /api/user/preferences`
  - opcjonalnie: `GET /api/me` dla stanu kompletności.

#### Widok: Ustawienia konta
- **Ścieżka**: `/settings`
- **Główny cel**: wylogowanie i „Usuń konto” (US‑003, US‑005).
- **Kluczowe informacje**:
  - e-mail (z `GET /api/me`),
  - ostrzeżenia o konsekwencjach usunięcia.
- **Kluczowe komponenty**:
  - sekcja „Sesja”: „Wyloguj”,
  - sekcja „Dane”: „Usuń konto” z potwierdzeniem.
- **UX, dostępność i bezpieczeństwo**:
  - bezpieczeństwo: reautoryzacja/próg bezpieczeństwa przed usunięciem (jeśli wymagane przez dostawcę auth).
  - a11y: `AlertDialog` z poprawnym focus trap.
- **Powiązanie z API**:
  - `GET /api/me` (tożsamość)
  - usunięcie konta: **niezdefiniowane w planie API** → UI przygotowany jako „feature placeholder” (MVP UI), wymagający dopięcia endpointu lub przepływu Supabase.

---

### 2.3 AI „Dostosuj przepis” (zagnieżdżone flow w szczegółach przepisu)

To jest **kluczowy przypadek użycia MVP** i składa się z powiązanych widoków modalnych / ekranów.

#### Widok modalny: Soft gate profilu
- **Umiejscowienie**: z `/recipes/[id]` po kliknięciu „Dostosuj” (przed wywołaniem job)
- **Główny cel**: jeśli profil niekompletny, ostrzec i dać wybór: „Uzupełnij profil” lub „Kontynuuj mimo to”.
- **Kluczowe komponenty**: `Dialog`/`AlertDialog` + `Alert` (warning), CTA do `/profile/edit`.
- **Powiązanie z API**: `GET /api/me` (profile completeness).

#### Widok modalny: „Dostosuj przepis” (presety + parametry)
- **Umiejscowienie**: modal na `/recipes/[id]`
- **Główny cel**: wybrać preset(y) i parametry, zapamiętać ostatnie użycia, uruchomić job.
- **Kluczowe informacje**:
  - globalne przypięte presety + presety person (3 na personę),
  - „Ostatnio używane” (localStorage, max 5),
  - parametry: `avoid_allergens`, `use_exclusions`, `target_calories`, wybór presetów.
- **Kluczowe komponenty**:
  - lista presetów (karty), sekcja „ostatnio używane”,
  - formularz parametrów z walidacją,
  - CTA: „Dostosuj”.
- **UX, dostępność i bezpieczeństwo**:
  - UX: preset wypełnia formularz, ale parametry pozostają edytowalne.
  - localStorage: przechowujemy tylko ID presetów + timestamp (bez danych wrażliwych).
  - a11y: focus trap w modalu, skróty klawiaturowe (Esc zamyka, o ile bez ryzyka utraty pracy).
- **Powiązanie z API**:
  - `GET /api/presets`
  - start job: `POST /api/recipes/{id}/ai-adjustments` (obsługa 429 limit-exceeded, 422, 404, 401)

#### Widok modalny: Progress + polling joba
- **Umiejscowienie**: modal po `POST /ai-adjustments`
- **Główny cel**: pokazać postęp i bezpiecznie obsłużyć statusy: `processing`, `timeout`, `invalid-json`, `validation-fail`, `limit-exceeded`.
- **Kluczowe informacje**:
  - status, opis błędu, licznik retry i/lub czas do resetu limitu,
  - (opcjonalnie) czas trwania.
- **Kluczowe komponenty**:
  - `Progress`/spinner,
  - komunikaty + CTA „Spróbuj ponownie” (max 2–3 próby) z backoff,
  - CTA „Zamknij”/„Anuluj”.
- **UX, dostępność i bezpieczeństwo**:
  - UX: polling z exponential backoff (start 1s, max 5s) + limit retry.
  - a11y: dynamiczne komunikaty jako live region (ostrożnie, nie spamować SR).
  - bezpieczeństwo: brak wycieku szczegółów walidacji poza niezbędne (ale `validation-fail` powinno pokazać listę alergenów / wskazanie niepewności).
- **Powiązanie z API**:
  - `GET /api/ai-adjustments/{job_id}`
  - opcjonalnie: `POST /api/analytics/logs` dla `AIAdjustRequested/Succeeded/Failed`.

#### Widok: Diff view (porównanie oryginał vs dostosowany)
- **Umiejscowienie**:
  - rekomendacja: **dedykowana trasa** `/recipes/[id]/ai/[jobId]` (łatwy router guard, linkowalność, refresh-safe),
  - alternatywa: nadal modal na `/recipes/[id]` (mniej robust na odświeżenie).
- **Główny cel**: pokazać różnice, umożliwić akceptację zmian, chronić niezapisane edycje.
- **Kluczowe informacje**:
  - wersja oryginalna i dostosowana (pola: tytuł, składniki, kroki, makro/porcje),
  - wynik walidacji (soft block przy `validation-fail`),
  - disclaimer prawny.
- **Kluczowe komponenty**:
  - side-by-side diff (sekcyjnie),
  - disclaimer + checkbox „Rozumiem” (jeśli wymagane),
  - CTA: „Zaakceptuj zmiany” (persist poprzez zapis przepisu/nowej wersji – zgodnie z backendem),
  - `UnsavedChangesGuard`: router guard + `beforeunload` tylko gdy `isDirty=true`.
- **UX, dostępność i bezpieczeństwo**:
  - UX: wyraźne rozróżnienie „oryginał” vs „dostosowane”; możliwość ręcznej korekty.
  - a11y: odpowiednia struktura nagłówków i opisów; obsługa klawiatury w edycji.
  - bezpieczeństwo: nie utrwalać danych bez jawnej akcji „Zaakceptuj”.
- **Powiązanie z API**:
  - `GET /api/ai-adjustments/{job_id}` (źródło `adjusted_recipe_id`)
  - `GET /api/recipes/{adjusted_recipe_id}` oraz `GET /api/recipes/{original_recipe_id}`
  - akceptacja: zależnie od modelu danych:
    - jeśli „adjusted recipe” już istnieje i ma być przyjęty: przekierowanie do niego,
    - jeśli UI ma zapisać korekty: `PATCH /api/recipes/{adjusted_recipe_id}`.

---

### 2.4 Admin (rola + feature flag)

#### Widok: Admin – lista alergenów
- **Ścieżka**: `/admin/allergens`
- **Główny cel**: zarządzać słownikiem alergenów i synonimów, z wyszukiwaniem i statusem aktywności.
- **Kluczowe informacje**: lista wpisów (nazwa, synonimy, aktywny), paginacja, wyszukiwarka `q`.
- **Kluczowe komponenty**:
  - tabela/lista z akcjami „Edytuj”, „Deaktywuj/Usuń”, „Audyt”,
  - formularz „Dodaj wpis” (modal lub inline),
  - filtry: `is_active`, `q`.
- **UX, dostępność i bezpieczeństwo**:
  - bezpieczeństwo: dostęp tylko gdy `role=admin` i feature flag aktywna; dodatkowo walidacja `Origin/Referer` dla mutacji.
  - a11y: tabela z nagłówkami, przyciski akcji z opisami.
- **Powiązanie z API**:
  - `GET /api/admin/allergens`
  - `POST /api/admin/allergens`
  - `PATCH /api/admin/allergens/{id}`
  - `DELETE /api/admin/allergens/{id}`

#### Widok: Admin – audyt alergenów
- **Ścieżka**: `/admin/allergens/[id]/audit`
- **Główny cel**: wgląd w nienadpisywalny audyt zmian (kto/kiedy/co).
- **Kluczowe informacje**: lista wpisów audytu z diffem wartości (stare/nowe).
- **Komponenty**: tabela audytu, filtry dat (opcjonalnie), link „Wróć”.
- **Powiązanie z API**:
  - `GET /api/admin/allergens/{id}/audit`

---

### 2.5 Wspólne strony błędów (po zalogowaniu)

#### Widok: Brak dostępu
- **Ścieżka**: `/403` (lub komponent w guardzie)
- **Cel**: jasna informacja, że użytkownik nie ma uprawnień (np. admin).

#### Widok: Błąd serwera / offline / timeout
- **Ścieżka**: `/error` (lub komponent globalny)
- **Cel**: fallback dla 500/504 + opcja „Spróbuj ponownie”.

## 3. Mapa podróży użytkownika

### 3.1 Główny przypadek użycia: „Dostosuj przepis przez AI i zaakceptuj zmiany” (US‑030)

- **Wejście do aplikacji**
  - `/login` → sukces auth → `GET /api/me`
  - jeśli profil niekompletny: `/onboarding` (lub `/profile/edit?mode=onboarding`)
  - w przeciwnym razie: `/recipes`

- **Wybór przepisu**
  - `/recipes` → klik w kartę → `/recipes/[id]` (pobranie `GET /api/recipes/{id}`)

- **Uruchomienie AI**
  - klik „Dostosuj przepis”
  - `GET /api/me`:
    - jeśli `profile.is_complete=false`: modal soft gate → „Uzupełnij profil” (→ `/profile/edit`) lub „Kontynuuj mimo to”
  - modal presetów:
    - `GET /api/presets` (sekcje: globalne, persona, użytkownika) + „ostatnio używane” z localStorage
    - wybór presetów/parametrów → „Dostosuj”
  - `POST /api/recipes/{id}/ai-adjustments`:
    - 202: dostajemy `job_id` → modal progress
    - 429: limit-exceeded → komunikat + licznik do resetu (w strefie użytkownika, jeśli dostępna)
    - 422: walidacja parametrów → błędy formularza inline

- **Polling**
  - cykliczne `GET /api/ai-adjustments/{job_id}` (backoff 1–5 s)
  - statusy:
    - `processing/pending`: spinner/progress
    - `timeout`: komunikat + „Spróbuj ponownie” (max 2–3 próby)
    - `invalid-json`: komunikat + retry
    - `validation-fail`: komunikat + przejście do diff view z soft block i listą problemów
    - `limit-exceeded`: komunikat + blokada do resetu
    - `completed`: przejście do diff view

- **Diff view + akceptacja**
  - rekomendowana trasa: `/recipes/[id]/ai/[jobId]`
  - pobranie oryginału i dostosowanego przepisu (`GET /api/recipes/{...}`)
  - porównanie side-by-side + disclaimer
  - ewentualna ręczna korekta → `isDirty=true`:
    - router guard + `beforeunload` aktywne tylko dla `isDirty`
  - „Zaakceptuj zmiany”:
    - zapis docelowej wersji (np. `PATCH /api/recipes/{adjusted_recipe_id}`)
    - przekierowanie do `/recipes/[adjusted_recipe_id]` lub pozostanie na szczególe (zależnie od modelu danych)

### 3.2 Pozostałe kluczowe podróże

- **Dodanie przepisu** (US‑020/021/022)
  - `/recipes` → „Nowy przepis” → `/recipes/new`
  - wklej surowy tekst → parsowanie (klient) + confidence
  - ostrzeżenia przy niskim confidence → „Zapisz mimo to”
  - `POST /api/recipes` → redirect `/recipes/[id]`

- **Edycja / usuwanie** (US‑024/025)
  - `/recipes/[id]` → „Edytuj” → `/recipes/[id]/edit` → `PATCH /api/recipes/{id}`
  - `/recipes/[id]` → „Usuń” → potwierdzenie → `DELETE /api/recipes/{id}` → `/recipes`

- **Oceny i ulubione** (US‑027/028)
  - `/recipes/[id]` (i opcjonalnie karty na `/recipes`) → akcje inline
  - `PUT /rating`, `PUT /favorite` (optymistycznie, z rollbackiem)

- **Profil preferencji** (US‑010/011/012)
  - `/onboarding` (pierwsze wejście) lub `/profile/edit` (później)
  - `PUT /api/user/preferences` + walidacje 422
  - po uzupełnieniu: `ProfileCompleted` do analityki (jeśli wdrożone)

- **Admin** (US‑050/051)
  - w headerze widoczny link „Admin” tylko dla adminów i aktywnej flagi
  - `/admin/allergens` → CRUD wpisów + `/admin/allergens/[id]/audit`

## 4. Układ i struktura nawigacji

### 4.1 Publiczna nawigacja
- Prosty układ (bez App Shell):
  - `/login` ↔ `/signup`
  - link „Polityka prywatności” (jeśli dostępna) jako stopka.

### 4.2 Nawigacja po zalogowaniu (App Shell)
- **Header** (stały):
  - logo / „HealthyMeal” → `/recipes`
  - główne CTA: „Nowy przepis” → `/recipes/new`
  - (opcjonalnie) link „Przepisy” → `/recipes`
  - menu użytkownika:
    - „Profil” → `/profile/edit`
    - „Ustawienia” → `/settings`
    - „Wyloguj”
  - link „Admin” → `/admin/allergens` (tylko gdy rola + feature flag)
- **Zasady przekierowań i guardów**:
  - brak tokenu / 401: redirect do `/login?returnUrl=...`
  - brak uprawnień admin: `/403` (bez ujawniania szczegółów)
  - „dirty guard” w diff view i edycji: blokada nawigacji + `beforeunload` tylko gdy `isDirty=true`
- **Deep-linking i powrót**:
  - filtry listy jako query params w `/recipes`
  - diff view jako osobna trasa (rekomendowane) – odporne na refresh.

## 5. Kluczowe komponenty (wielokrotnego użycia)

- **`AppShell` (layout)**: header + obszar treści; wspólne zachowanie nawigacji.
- **`AuthGuard` / `RouteGuard`**: wymusza zalogowanie; obsługuje redirect z `returnUrl`.
- **`AdminGuard`**: dodatkowo sprawdza rolę + feature flag (UI + middleware).
- **`ApiClient` + centralny error handler**: mapowanie kodów HTTP → komunikaty; wsparcie kopert; spójne 422/429/401; opcjonalne logowanie do `POST /api/analytics/logs`.
- **`ErrorBoundary` + `ErrorState`**: fallback dla błędów nieoczekiwanych; „Spróbuj ponownie”.
- **`Toast/AlertCenter`**: nieinwazyjne komunikaty (sukces/błąd), w tym rollback przy optymistycznym UI.
- **`RecipeCard`**: karta na liście (tytuł, tagi, ulubione, ocena, meta).
- **`RecipeFilters`**: sidebar/drawer filtrów + debounce + synchronizacja z URL.
- **`RecipeFormWizard`**: tworzenie przepisu (kroki, walidacja, confidence, ostrzeżenia).
- **`RatingControl`**: 1–5, dostępny klawiaturą i SR-friendly.
- **`FavoriteToggle`**: toggle z optymistycznym UI.
- **`ServingScaler`**: kalkulacja porcji + `no_scale` per składnik + format ułamków (1/2, 1/3) + ostrzeżenie „wypieki”.
- **`AiAdjustEntryModal`**: presety + parametry + „ostatnio używane”.
- **`AiJobProgressModal`**: polling + backoff + retry + obsługa statusów.
- **`DiffView`**: porównanie i edycja; disclaimer; CTA „Zaakceptuj”.
- **`UnsavedChangesGuard`**: router guard + `beforeunload` zależne od `isDirty`.
- **`AdminAllergenEditor` + `AdminAuditTable`**: CRUD słownika i podgląd audytu.

## 6. Kluczowe wymagania z PRD → mapowanie na UI

- **Prywatność danych (wszystko prywatne)**:
  - wymuszona autentykacja na trasach chronionych; brak „publicznych przepisów”; bezpieczne 404.
- **CRUD przepisów (bez wersjonowania)**:
  - `/recipes`, `/recipes/new`, `/recipes/[id]`, `/recipes/[id]/edit` + potwierdzenia usunięcia.
- **Zestrukturyzuj + confidence + ostrzeżenie**:
  - wizard tworzenia/edycji z Badge confidence, `Alert` dla <0,9, możliwość zapisu mimo ostrzeżeń.
- **Oceny i ulubione (prywatne)**:
  - akcje inline na szczególe + opcjonalnie na karcie; sorty na liście.
- **Filtry, wyszukiwanie, sortowanie**:
  - sidebar filtrów + debounce; sort w headerze listy; paginacja.
- **Skalowanie porcji z regułami i „nie skaluj”**:
  - `ServingScaler` w szczególe; ostrzeżenia dla wypieków.
- **AI „Dostosuj” (1 akcja)**:
  - modal presetów + parametry; progress/polling; diff view + disclaimer.
- **Walidacja po‑AI i soft block**:
  - w statusie `validation-fail`: czytelny soft block i wskazanie problemów w diff view.
- **Limit dzienny i timeout**:
  - obsługa 429 i statusów `timeout/limit-exceeded` z komunikatem i licznikiem.
- **Brak autosave + ochrona „dirty”**:
  - `UnsavedChangesGuard` w diff view (i edycji), aktywny tylko przy `isDirty=true`.
- **Onboarding ≤60s + soft gate**:
  - `/onboarding` + soft gate przed AI, z szybkim przejściem do `/profile/edit`.
- **Admin słownik alergenów + audyt**:
  - `/admin/allergens` + `/admin/allergens/[id]/audit`, tylko rola+feature flag.
- **Analityka minimalna**:
  - zdarzenia UI → `POST /api/analytics/logs` (zwłaszcza AI i ProfileCompleted).

## 7. Główne punkty końcowe API i cele (mapowanie UI ↔ API)

- **Tożsamość**: `GET /api/me` → stan zalogowania, kompletność profilu, strefa czasowa.
- **Preferencje**: `GET/POST/PUT /api/user/preferences` → onboarding i edycja profilu.
- **Przepisy**:
  - `GET /api/recipes` → lista + filtry/sort/paginacja,
  - `POST /api/recipes` → tworzenie,
  - `GET /api/recipes/{id}` → szczegół,
  - `PATCH /api/recipes/{id}` → edycja,
  - `DELETE /api/recipes/{id}` → usunięcie.
- **Oceny i ulubione**:
  - `PUT/DELETE /api/recipes/{id}/rating` → ocena 1–5,
  - `PUT /api/recipes/{id}/favorite` → toggle ulubionych.
- **AI jobs**:
  - `POST /api/recipes/{id}/ai-adjustments` → start job,
  - `GET /api/ai-adjustments/{job_id}` → polling statusu,
  - `GET /api/recipes/{id}/ai-adjustments` → historia jobów (opcjonalny widok w szczególe).
- **Presety**: `GET /api/presets` (+ CRUD jeśli udostępnimy UI do zarządzania presetami).
- **Admin**:
  - `GET/POST/PATCH/DELETE /api/admin/allergens`,
  - `GET /api/admin/allergens/{id}/audit`.
- **Analityka**: `POST /api/analytics/logs` → logowanie zdarzeń.

## 8. Mapowanie historyjek użytkownika (PRD) → widoki/komponenty

- **US‑001 Rejestracja** → `/signup` + redirect do `/onboarding`/`/profile/edit` + `GET /api/me`.
- **US‑002 Logowanie** → `/login` + `GET /api/me` + redirect `/recipes`.
- **US‑003 Wylogowanie** → menu użytkownika w `AppShell` oraz `/settings`.
- **US‑004 Rate limit logowania** → `/login` (obsługa 429 + licznik czasu), spójne komunikaty.
- **US‑005 Usunięcie konta i danych** → `/settings` (UI + potwierdzenie; wymaga dopięcia API/flow po stronie auth).
- **US‑010 Onboarding profilu + soft gate** → `/onboarding` oraz modal soft gate przed AI na `/recipes/[id]`.
- **US‑011 Edycja profilu** → `/profile/edit`.
- **US‑012 Cele kaloryczne/porcje** → formularz profilu (`/onboarding`, `/profile/edit`) + użycie jako domyślne w `ServingScaler` i parametrach AI.
- **US‑020 Dodanie przepisu (wklej tekst)** → `/recipes/new` (krok 1).
- **US‑021 Zestrukturyzowanie przepisu** → `/recipes/new` (krok 2 + confidence).
- **US‑022 Zapis z ostrzeżeniem** → `/recipes/new` (Alert + CTA „Zapisz mimo to”).
- **US‑023 Widok szczegółu** → `/recipes/[id]`.
- **US‑024 Edycja przepisu** → `/recipes/[id]/edit`.
- **US‑025 Usunięcie przepisu** → `/recipes/[id]` (potwierdzenie) + redirect `/recipes`.
- **US‑026 Lista z filtrami/sortem** → `/recipes` (filters + sort + debounce).
- **US‑027 Prywatna ocena** → `RatingControl` na `/recipes/[id]` (+ opcjonalnie karta na `/recipes`).
- **US‑028 Ulubione** → `FavoriteToggle` na `/recipes/[id]` i `/recipes` + filtr favorite + sort favorites.
- **US‑029 Skalowanie porcji** → `ServingScaler` na `/recipes/[id]`.
- **US‑030 Dostosowanie AI** → modal presetów + progress/polling + diff view (z `/recipes/[id]`).
- **US‑032 Walidacja bezpieczeństwa po‑AI** → obsługa `validation-fail` w progress/diff view (soft block + wskazania).
- **US‑034 Dzienny limit** → obsługa 429/`limit-exceeded` w AI flow + licznik resetu.
- **US‑035 Ochrona szkicu (dirty)** → `UnsavedChangesGuard` w diff view (i edycji).
- **US‑040 Presety per persona** → modal „Dostosuj” (sekcje: globalne, persona).
- **US‑041 Ostatnio używane presety** → localStorage w modalu „Dostosuj”.
- **US‑050 Admin – zarządzanie słownikiem** → `/admin/allergens` (CRUD) + guard rola+flaga.
- **US‑051 Admin – audyt** → `/admin/allergens/[id]/audit`.

## 9. Potencjalne punkty bólu użytkownika i jak UI je adresuje

- **Niepewność „czy AI jest bezpieczne”**:
  - wyraźny disclaimer, „soft block” dla `validation-fail`, transparentna lista problemów, możliwość korekty.
- **Frustracja przez limity i timeouty**:
  - czytelne komunikaty, retry max 2–3, licznik do resetu limitu (wg strefy użytkownika), możliwość powrotu bez utraty kontekstu.
- **Przeciążenie onboardingiem**:
  - tryb `/onboarding` z minimalną liczbą pól, checklist/progress, sensowne domyślne.
- **Trudność w przeglądaniu wielu przepisów**:
  - filtry w sidebarze + debounce, czytelne karty, sorty, paginacja.
- **Ryzyko utraty pracy w diff/edycji**:
  - `UnsavedChangesGuard` aktywny tylko przy `isDirty=true` (bez irytujących alertów, gdy „clean”).


