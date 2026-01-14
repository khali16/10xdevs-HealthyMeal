# Podsumowanie rozmowy - Planowanie architektury UI dla HealthyMeal MVP

<conversation_summary>

<decisions>

1. **Struktura nawigacji i routing**: Zaimplementować główną nawigację z headerem zawierającym menu użytkownika i przycisk do tworzenia nowego przepisu. Po autentykacji użytkownik jest automatycznie przekierowywany do `/recipes`. Widok szczegółu przepisu (`/recipes/[id]`) zawiera akcje inline (ocena, ulubione, skalowanie porcji) oraz przycisk "Dostosuj przepis" otwierający modal. Panel admin (`/admin/allergens`) dostępny tylko dla użytkowników z rolą `admin` i aktywną feature flagą, z osobną ścieżką nawigacyjną.

2. **Formularz tworzenia przepisu**: Wieloetapowy formularz. Krok 1: ekran wklejania tekstu surowego (przepis + bullet pointy jako składniki). Używać komponentów Shadcn/ui: `Textarea`, `Alert`, `Badge` dla confidence. Parsowanie i zestrukturyzowanie odbywa się po stronie klienta.

3. **Modal AI Adjustment z pollingiem**: Po `POST /api/recipes/{id}/ai-adjustments` wyświetlić modal z progress indicator. Implementować polling z exponential backoff (start: 1s, max: 5s) do `GET /api/ai-adjustments/{job_id}`. Obsługa statusów: `processing` → spinner, `timeout` → komunikat z "Spróbuj ponownie" (max 2-3 próby), `limit-exceeded` → komunikat z licznikiem do resetu o północy, `validation-fail` → soft block z listą alergenów, `invalid-json` → komunikat z opcją ponowienia. Po sukcesie (`completed`) → side-by-side diff view z disclaimerem prawnym i przyciskiem "Zaakceptuj zmiany".

4. **Soft gate dla niekompletnego profilu**: Przed uruchomieniem `POST /api/recipes/{id}/ai-adjustments` sprawdzać `profile.is_complete` z `GET /api/me`. Jeśli `false`, wyświetlić modal z komunikatem ostrzegawczym i przyciskami "Uzupełnij profil" (redirect do `/profile/edit`) oraz "Kontynuuj mimo to". Używać komponentu `Alert` z variant `warning`.

5. **Layout listy przepisów z filtrami**: Sidebar z filtrami: `Select` dla diety, `Slider` dla kalorii i czasu, `Switch` dla ulubionych, `Input` dla wyszukiwania. Główna sekcja z kartami przepisów w grid (responsive: 1 kolumna mobile, 2-3 tablet, 3-4 desktop). Header z `Select` dla sortowania. Debounce 500ms dla wyszukiwania i filtrów. Implementować infinite scroll lub paginację z `page` i `page_size`. Cache wyników w React state/store z invalidacją przy mutacjach.

6. **Router guard i beforeunload dla dirty state**: W komponencie diff view śledzić stan `isDirty` (true, gdy użytkownik edytował dostosowany przepis). Astro middleware/router guard sprawdzający `isDirty` przed nawigacją. Event listener `beforeunload` tylko gdy `isDirty === true`. Przy próbie nawigacji wewnętrznej pokazywać modal `AlertDialog`: "Masz niezapisane zmiany. Czy na pewno chcesz opuścić tę stronę?" z opcjami "Anuluj" i "Opuść bez zapisywania".

7. **Sekcja skalowania porcji**: W widoku szczegółu przepisu dodać sekcję "Skalowanie porcji" z `Input` typu number dla docelowej liczby porcji (domyślnie z `user_preferences.target_servings` lub `recipe.servings`). Lista składników z obliczonymi wartościami po przeskalowaniu, każdy składnik ma toggle "Nie skaluj". Dla wartości ułamkowych używać komponentu wyświetlającego ułamki (np. "1/2", "1/3"). Dla wypieków wyświetlać `Alert` z ostrzeżeniem. Obliczenia po stronie klienta (prezentacyjne, nie zapisuje się w przepisie).

8. **Autentykacja JWT**: JWT będzie wdrożone w późniejszym etapie. Na razie pomijamy szczegóły implementacji autentykacji.

9. **Modal "Dostosuj przepis" z presetami**: Modal zawiera: (1) sekcję "Presety" z kartami (3 globalne przypięte na górze, następnie po 3 per persona: "Diety eliminacyjne", "Sportowcy", "Początkujący"), (2) sekcję "Ostatnio używane" (z localStorage, max 5), (3) sekcję "Parametry" z formularzem (checkboxy dla `avoid_allergens`, `use_exclusions`, `Input` dla `target_calories`, `Select` dla wyboru presetów). Po wyborze presetów wypełniać formularz parametrów, ale pozwalać na edycję. Przycisk "Dostosuj" uruchamia `POST /api/recipes/{id}/ai-adjustments`. Po użyciu presetów zapisywać ich ID w localStorage z timestampem (sortować po ostatnim użyciu). Używać komponentów: `Dialog`, `Card`, `Checkbox`, `Input`.

10. **Centralny error handler**: Stworzyć w `src/lib/api-client.ts` mapujący kody HTTP na user-friendly komunikaty. Dla `422` wyświetlać `fieldErrors` inline w formularzach (używać `Form` z Shadcn/ui z walidacją). Dla `401` automatycznie przekierowywać do `/login` z return URL. Dla `429` pokazywać `Alert` z komunikatem i pozostałym czasem (rate limit logowania) lub licznikiem do resetu (AI limit). Dla `404` wyświetlać stronę "Nie znaleziono" z linkiem powrotu. Dla `500/504` pokazywać ogólny komunikat błędu z opcją "Spróbuj ponownie". Używać React Error Boundary dla nieoczekiwanych błędów. Wszystkie błędy logować do `POST /api/analytics/logs` z odpowiednim `action` i `status`.

</decisions>

<matched_recommendations>

1. **Hierarchia widoków i nawigacja**: Zgodnie z decyzją użytkownika, struktura nawigacji obejmuje główny header z menu użytkownika, przekierowanie do `/recipes` po autentykacji, widok szczegółu z akcjami inline oraz panel admin z kontrolą dostępu. To odpowiada rekomendacji dotyczącej struktury widoków i przepływów użytkownika.

2. **Wieloetapowy formularz tworzenia przepisu**: Decyzja o pominięciu endpointa `POST /api/recipes/structure` i implementacji parsowania po stronie klienta jest zgodna z rekomendacją dotyczącą przepływu tworzenia przepisu, ale uproszczona w zakresie integracji z API.

3. **Asynchroniczny proces AI adjustment**: Implementacja modala z pollingiem, obsługą różnych statusów błędów i side-by-side diff view jest w pełni zgodna z rekomendacją dotyczącą interfejsu dla asynchronicznego procesu AI.

4. **Soft gate dla niekompletnego profilu**: Implementacja modala sprawdzającego `profile.is_complete` przed uruchomieniem AI adjustment jest zgodna z rekomendacją dotyczącą soft gate.

5. **Layout listy przepisów z filtrami**: Decyzja o sidebarem filtrów, debounce 500ms, paginacji/infinite scroll i cache w React state jest zgodna z rekomendacją dotyczącą widoku listy przepisów.

6. **Router guard i beforeunload**: Implementacja śledzenia stanu `isDirty` w diff view oraz router guard i beforeunload jest zgodna z rekomendacją dotyczącą ochrony szkicu AI.

7. **Sekcja skalowania porcji**: Implementacja sekcji skalowania porcji z obliczeniami po stronie klienta jest zgodna z rekomendacją, z dodatkowym wymaganiem wyświetlania ułamków.

8. **Autentykacja**: Decyzja o odłożeniu implementacji JWT na późniejszy etap jest zgodna z rekomendacją, ale wymaga późniejszego dopracowania.

9. **Modal z presetami**: Implementacja modala z presetami, localStorage dla ostatnio używanych i formularzem parametrów jest zgodna z rekomendacją dotyczącą modala "Dostosuj przepis".

10. **Centralny error handler**: Implementacja centralnego error handlera w API client z mapowaniem kodów HTTP i logowaniem błędów jest w pełni zgodna z rekomendacją dotyczącą obsługi błędów API.

</matched_recommendations>

<ui_architecture_planning_summary>

## Główne wymagania dotyczące architektury UI

HealthyMeal MVP wymaga responsywnej aplikacji web z następującymi kluczowymi elementami architektury:

### Struktura aplikacji i routing

- **Główna nawigacja**: Header z menu użytkownika, przycisk do tworzenia przepisu, linki do głównych sekcji
- **Routing**: 
  - `/recipes` - główna lista przepisów (domyślny widok po autentykacji)
  - `/recipes/new` - formularz tworzenia przepisu
  - `/recipes/[id]` - szczegóły przepisu z akcjami inline
  - `/profile/edit` - edycja profilu preferencji
  - `/admin/allergens` - panel administracyjny (tylko dla adminów z feature flagą)
- **Kontrola dostępu**: Middleware sprawdzający autentykację i role użytkownika

### Kluczowe widoki i ekrany

1. **Lista przepisów** (`/recipes`):
   - Sidebar z filtrami (dieta, kalorie, czas, ulubione, wyszukiwanie)
   - Grid responsywny z kartami przepisów
   - Header z sortowaniem (Najnowsze, Ulubione, Najwyżej ocenione)
   - Paginacja lub infinite scroll
   - Cache wyników w React state/store

2. **Formularz tworzenia przepisu** (`/recipes/new`):
   - Krok 1: Wklejanie tekstu surowego (Textarea)
   - Parsowanie po stronie klienta (bez endpointa structure)
   - Wyświetlanie confidence scores z Badge
   - Alert dla niskiego confidence
   - Możliwość ręcznej edycji przed zapisem

3. **Szczegóły przepisu** (`/recipes/[id]`):
   - Nagłówek z tytułem i tagami (czas, kalorie, dieta, ocena)
   - Sekcje: makro, kroki, czas, porcje
   - Akcje inline: ocena (1-5), ulubione (toggle), skalowanie porcji
   - Przycisk "Dostosuj przepis" otwierający modal z presetami
   - Sekcja skalowania porcji z obliczeniami po stronie klienta

4. **Modal "Dostosuj przepis"**:
   - Sekcja presetów (3 globalne + po 3 per persona)
   - Sekcja "Ostatnio używane" (localStorage, max 5)
   - Formularz parametrów (checkboxy, inputy, selecty)
   - Soft gate modal dla niekompletnego profilu
   - Modal z progress indicator i pollingiem statusu

5. **Diff view (po AI adjustment)**:
   - Side-by-side porównanie oryginału vs. dostosowanego
   - Disclaimer prawny
   - Przycisk "Zaakceptuj zmiany"
   - Śledzenie stanu `isDirty` dla router guard

6. **Panel administracyjny** (`/admin/allergens`):
   - Zarządzanie słownikiem alergenów
   - Audyt zmian
   - Dostęp tylko dla adminów z feature flagą

### Strategia integracji z API i zarządzania stanem

- **API Client** (`src/lib/api-client.ts`):
  - Centralny error handler mapujący kody HTTP na user-friendly komunikaty
  - Automatyczne przekierowania (401 → `/login`)
  - Logowanie błędów do `POST /api/analytics/logs`
  - Obsługa envelope formatów odpowiedzi (`{ data, meta, error }`)

- **Zarządzanie stanem**:
  - React state/store dla cache wyników listy przepisów
  - Invalidacja cache przy mutacjach (tworzenie, edycja, usuwanie)
  - localStorage dla ostatnio używanych presetów (max 5)
  - Śledzenie stanu `isDirty` w diff view

- **Polling i asynchroniczne operacje**:
  - Exponential backoff dla polling AI adjustments (start: 1s, max: 5s)
  - Progress indicator w modalu
  - Obsługa różnych statusów błędów z odpowiednimi komunikatami

### Kwestie dotyczące responsywności, dostępności i bezpieczeństwa

- **Responsywność**:
  - Grid przepisów: 1 kolumna (mobile), 2-3 (tablet), 3-4 (desktop)
  - Sidebar filtrów: drawer na mobile, sidebar na desktop
  - Wszystkie komponenty Shadcn/ui są responsywne z natury

- **Dostępność**:
  - Komponenty Shadcn/ui są dostępne (a11y) z natury
  - Proper ARIA labels dla formularzy i akcji
  - Keyboard navigation wspierana przez Radix UI (podstawa Shadcn/ui)

- **Bezpieczeństwo**:
  - Router guard sprawdzający autentykację przed dostępem do protected routes
  - Kontrola dostępu do panelu admin (rola + feature flag)
  - Wszystkie requesty API z Bearer JWT (do wdrożenia w późniejszym etapie)
  - Rate limiting obsługiwany po stronie API z odpowiednimi komunikatami w UI

### Komponenty UI i biblioteki

- **Shadcn/ui komponenty** (już zainstalowane):
  - `Alert`, `AlertDialog`, `Badge`, `Button`, `Card`, `Checkbox`, `Dialog`, `DropdownMenu`, `Form`, `Input`, `Label`, `Progress`, `Select`, `Separator`, `Sheet`, `Slider`, `Switch`, `Textarea`, `Skeleton`

- **Dodatkowe komponenty do stworzenia**:
  - Header z nawigacją i menu użytkownika
  - Karty przepisów w grid
  - Modal AI adjustment z progress indicator
  - Diff view (side-by-side)
  - Sekcja skalowania porcji z wyświetlaniem ułamków
  - Soft gate modal
  - Modal z presetami

### Przepływy użytkownika

1. **Rejestracja/Logowanie → Lista przepisów**:
   - Po autentykacji automatyczne przekierowanie do `/recipes`
   - Jeśli profil niekompletny, soft gate przy próbie użycia AI

2. **Tworzenie przepisu**:
   - Wklejanie tekstu → Parsowanie po stronie klienta → Edycja → Zapis

3. **Dostosowanie przepisu przez AI**:
   - Kliknięcie "Dostosuj przepis" → Sprawdzenie profilu (soft gate jeśli niekompletny) → Wybór presetów/parametrów → Uruchomienie job → Polling statusu → Diff view → Zaakceptowanie zmian

4. **Edycja i zarządzanie przepisami**:
   - Lista z filtrami → Szczegóły → Edycja/Ocena/Ulubione/Skalowanie → Zapis

### Obsługa błędów i edge cases

- **Error handling**:
  - Centralny error handler w API client
  - React Error Boundary dla nieoczekiwanych błędów
  - Inline field errors dla 422 w formularzach
  - Komunikaty dla rate limits (429) z licznikami
  - Strona 404 z linkiem powrotu
  - Ogólne komunikaty błędów (500/504) z opcją retry

- **Edge cases**:
  - Router guard i beforeunload dla dirty state w diff view
  - Soft block dla validation-fail w AI adjustments
  - Ostrzeżenia dla wypieków przy skalowaniu porcji
  - Obsługa timeout i limit-exceeded z odpowiednimi komunikatami

</ui_architecture_planning_summary>

<unresolved_issues>

1. **Autentykacja JWT**: Implementacja JWT zostanie wdrożona w późniejszym etapie. Wymaga to dopracowania:
   - Integracji z Supabase Auth
   - Middleware do weryfikacji tokenów
   - Obsługi refresh tokenów
   - Logout i czyszczenia cache

2. **Onboarding profilu**: Wymagany jest przepływ onboardingu (≤60s) z przekierowaniem do `/profile/edit` po pierwszym logowaniu, jeśli profil niekompletny. Szczegóły implementacji wymagają dopracowania.

3. **Parsowanie przepisów po stronie klienta**: Decyzja o pominięciu endpointa `POST /api/recipes/structure` wymaga stworzenia logiki parsowania tekstu surowego po stronie klienta. Wymaga to dopracowania algorytmu parsowania i wyznaczania confidence scores.

4. **Wyświetlanie ułamków w skalowaniu**: Wymagany jest komponent do wyświetlania ułamków (np. "1/2", "1/3") zamiast dziesiętnych. Szczegóły implementacji wymagają dopracowania.

5. **Feature flag dla panelu admin**: Wymagana jest implementacja systemu feature flags do kontroli dostępu do panelu administracyjnego. Szczegóły implementacji wymagają dopracowania.

6. **Timezone handling**: Reset limitu AI adjustments o północy w strefie użytkownika wymaga obsługi timezone. Szczegóły implementacji wymagają dopracowania.

7. **Infinite scroll vs paginacja**: Decyzja o wyborze między infinite scroll a paginacją wymaga dopracowania na podstawie testów UX.

8. **Cache invalidation strategy**: Szczegółowa strategia invalidacji cache przy mutacjach wymaga dopracowania (które mutacje invalidują które cache).

</unresolved_issues>

</conversation_summary>

