<analiza_projektu>
### 1. Kluczowe komponenty projektu
Na podstawie analizy kodu i struktury plików, zidentyfikowałem następujące kluczowe komponenty i funkcjonalności aplikacji "HealthyMeal":

*   **Moduł Uwierzytelniania i Autoryzacji:**
    *   Komponenty UI (`src/components/auth/`): Rejestracja, logowanie, przypominanie i resetowanie hasła, logowanie przez Google.
    *   Logika API (`src/pages/api/auth/`): Obsługa żądań rejestracji, logowania (w tym przez OAuth z Google), wylogowania.
    *   Mechanizmy bezpieczeństwa: Ograniczenie liczby prób logowania (`RateLimitAlert.tsx`).
    *   Integracja z Supabase Auth: Zarządzanie sesjami, użytkownikami i cookies (`supabase.client.ts`, `Layout.astro`).

*   **Zarządzanie Przepisami (CRUD):**
    *   **Tworzenie (`recipe-create`):** Kreator oparty na dwóch krokach: 1) wklejenie surowego tekstu, 2) weryfikacja i edycja sparsowanych danych. Kluczowym elementem jest parser (`parser.ts`) próbujący automatycznie wyodrębnić tytuł, składniki i kroki.
    *   **Odczyt (Lista i Szczegóły):**
        *   Widok listy (`RecipesListPage.tsx`): Wyświetla przepisy w formie siatki, oferuje filtrowanie (po tekście, diecie, kaloriach), sortowanie i paginację.
        *   Widok szczegółów (`RecipeDetailsPage.tsx`): Prezentuje pełne informacje o przepisie, w tym składniki, kroki, metadane.
    *   **Aktualizacja (`recipe-edit`):** Dedykowany formularz do edycji wszystkich pól istniejącego przepisu, włączając w to walidację (`validation.ts`).
    *   **Usuwanie:** Dostępne z poziomu widoku szczegółów, z oknem dialogowym potwierdzenia (`RecipeActionsMenu.tsx`).

*   **Interakcje z Przepisami:**
    *   **Ocenianie:** Użytkownicy mogą oceniać przepisy w skali 1-5 (`RecipeRatingControl.tsx`).
    *   **Ulubione:** Możliwość dodawania i usuwania przepisów z listy ulubionych (`RecipeFavoriteToggle.tsx`).
    *   **Skalowanie porcji:** W widoku szczegółów można dynamicznie przeliczać ilości składników w zależności od liczby porcji (`RecipeServingsScaler.tsx`).

*   **Preferencje Użytkownika:**
    *   Formularz (`UserPreferencesForm.tsx`) pozwalający użytkownikowi zdefiniować swoje preferencje żywieniowe: unikanie alergenów, wykluczanie składników, wybór diety, docelowa kaloryczność.
    *   Dane te prawdopodobnie wpływają na inne funkcje, zwłaszcza na dostosowanie AI.

*   **Funkcjonalności AI (Dostosowanie Przepisów):**
    *   Komponent (`RecipeAdjustButton.tsx`) inicjujący proces modyfikacji przepisu przez AI.
    *   Integracja z zewnętrzną usługą (`OpenRouterService.ts`) w celu generowania zmodyfikowanych wersji przepisów na podstawie presetów (np. "Lekka wersja", "Więcej białka") i preferencji użytkownika.
    *   Obsługa błędów i komunikacji z usługą AI (`src/lib/openrouter/errors.ts`).

*   **Panel Administracyjny (API):**
    *   Punkty końcowe API (`src/pages/api/admin/allergens/`) do zarządzania słownikiem alergenów, wymagające uprawnień administratora (`requireAdmin`).

### 2. Specyfika stosu technologicznego i wpływ na strategię testowania
*   **Astro:** Jako meta-framework "server-first", wymaga testowania zarówno logiki renderowanej na serwerze (SSR), jak i interaktywnych wysp renderowanych na kliencie (CSR). Testy E2E będą kluczowe do weryfikacji poprawnego działania obu tych warstw. Należy również przetestować punkty końcowe API zdefiniowane w `src/pages/api`.
*   **React:** Używany do budowy interaktywnych komponentów. To implikuje potrzebę testów komponentów (np. przy użyciu Vitest i React Testing Library) w celu weryfikacji ich renderowania, stanu i reakcji na interakcje użytkownika w izolacji.
*   **TypeScript:** Zapewnia bezpieczeństwo typów, co redukuje liczbę błędów na etapie developmentu. Testy powinny jednak skupić się na weryfikacji logiki biznesowej, przypadków brzegowych oraz poprawnej obsługi danych z zewnętrznych źródeł (API, formularze), gdzie typowanie może nie być wystarczające.
*   **Supabase:** Stanowi kręgosłup aplikacji (baza danych, uwierzytelnianie). Kluczowe jest testowanie:
    *   **Reguł RLS (Row Level Security):** Należy zweryfikować, czy użytkownicy mają dostęp wyłącznie do swoich danych (przepisów, preferencji) i nie mogą modyfikować danych innych użytkowników.
    *   **Integracji z API:** Sprawdzenie, czy wszystkie operacje na bazie danych wykonywane przez API działają zgodnie z oczekiwaniami.
    *   **Uwierzytelniania:** Testowanie przepływów logowania, rejestracji i zarządzania sesją.
*   **OpenRouter (AI API):** Jako krytyczna zależność zewnętrzna, wymaga strategii testowej opartej na mockowaniu. Należy testować odporność aplikacji na błędy API (np. niedostępność, timeout, niepoprawne odpowiedzi) oraz poprawność danych wysyłanych do usługi.
*   **Zod & React Hook Form:** Połączenie to jest używane do walidacji. Testy powinny obejmować:
    *   Walidację po stronie klienta (wyświetlanie błędów w formularzach).
    *   Walidację po stronie serwera (odrzucanie niepoprawnych żądań API).
    *   Przypadki brzegowe i nieprawidłowe dane wejściowe dla każdego schematu walidacji.

### 3. Priorytety testowe
1.  **Uwierzytelnianie i Autoryzacja:** Jako fundament bezpieczeństwa i personalizacji, musi działać niezawodnie. Błędy w tym obszarze mogą prowadzić do wycieku danych.
2.  **Podstawowe funkcje zarządzania przepisami (CRUD):** Jest to główna funkcjonalność aplikacji. Szczególną uwagę należy zwrócić na kreator tworzenia przepisów i jego logikę parsowania, która jest podatna na błędy.
3.  **Integracja z AI i Preferencje Użytkownika:** To unikalna i złożona funkcja. Należy dokładnie przetestować, jak preferencje wpływają na wyniki generowane przez AI.
4.  **Interakcje użytkownika z przepisami:** Filtrowanie, sortowanie, ocenianie i dodawanie do ulubionych to kluczowe elementy zaangażowania użytkownika.
5.  **Walidacja danych i obsługa błędów:** Zapewnienie integralności danych i dobrego UX poprzez jasne komunikaty o błędach.

### 4. Potencjalne obszary ryzyka
*   **Bezpieczeństwo:**
    *   **Niewłaściwa implementacja RLS w Supabase:** Ryzyko dostępu do danych innych użytkowników (ich przepisów, preferencji).
    *   **Cross-Site Scripting (XSS):** W polach tekstowych, takich jak tytuł, składniki czy kroki przepisu, użytkownik może próbować wstrzyknąć złośliwy kod. Należy upewnić się, że wszystkie dane wejściowe są odpowiednio sanitowane przed wyświetleniem.
    *   **Niebezpieczne użycie klucza `service_role`:** Klucz ten omija RLS i musi być używany wyłącznie na serwerze w bezpiecznym kontekście.
*   **Integralność danych:**
    *   **Parser przepisów (`parser.ts`):** Jest to niestandardowa logika, która może niepoprawnie interpretować różne formaty wklejanych przepisów, prowadząc do błędnie zapisanych danych. Wymaga testowania z szerokim wachlarzem danych wejściowych.
    *   **Brak spójności walidacji:** Różnice w logice walidacji między klientem (React Hook Form) a serwerem (API Zod) mogą prowadzić do nieoczekiwanych błędów.
*   **Zależności zewnętrzne:**
    *   **Niedostępność OpenRouter API:** Cała funkcja dostosowywania AI przestanie działać. Aplikacja musi być odporna na takie sytuacje, informując użytkownika i pozwalając na dalsze korzystanie z innych funkcji.
    *   **Zmiany w API OpenRouter:** Niezapowiedziane zmiany mogą zepsuć integrację.
*   **Wydajność:**
    *   **Zapytania do bazy danych:** Niewydajne filtrowanie lub sortowanie dużej liczby przepisów może spowolnić działanie aplikacji.
    *   **Czas odpowiedzi AI:** Generowanie odpowiedzi przez AI może być czasochłonne, co wpływa na UX. Należy zaimplementować odpowiednie wskaźniki ładowania.

</analiza_projektu>
<plan_testów>
# Plan Testów dla Aplikacji "HealthyMeal"

## 1. Wprowadzenie i cele testowania

### 1.1. Wprowadzenie
Niniejszy dokument opisuje plan testów dla aplikacji webowej "HealthyMeal". Aplikacja ta umożliwia użytkownikom zarządzanie przepisami kulinarnymi, personalizację preferencji żywieniowych oraz wykorzystanie sztucznej inteligencji do modyfikacji przepisów. Projekt oparty jest o nowoczesny stos technologiczny, w tym Astro, React, TypeScript, Supabase oraz integrację z zewnętrznym API (OpenRouter).

### 1.2. Cele testowania
Głównym celem procesu testowania jest zapewnienie wysokiej jakości, niezawodności, bezpieczeństwa i użyteczności aplikacji "HealthyMeal". Szczegółowe cele obejmują:
*   Weryfikację, czy wszystkie funkcjonalności aplikacji działają zgodnie ze specyfikacją.
*   Zapewnienie bezpieczeństwa danych użytkowników, w szczególności poprzez weryfikację mechanizmów autoryzacji.
*   Identyfikację i eliminację błędów krytycznych i poważnych przed wdrożeniem produkcyjnym.
*   Ocenę wydajności aplikacji pod kątem czasu ładowania i responsywności interfejsu.
*   Zapewnienie spójnego i intuicyjnego interfejsu użytkownika na różnych urządzeniach i przeglądarkach.
*   Weryfikację odporności aplikacji na błędy, w tym na niedostępność usług zewnętrznych.

## 2. Zakres testów

### 2.1. Funkcjonalności objęte testami
*   **Moduł uwierzytelniania:** Rejestracja, logowanie (e-mail/hasło, Google OAuth), wylogowanie, proces odzyskiwania hasła.
*   **Zarządzanie przepisami (CRUD):** Tworzenie przepisu za pomocą kreatora (wklejanie i parsowanie tekstu), edycja, usuwanie, wyświetlanie listy i szczegółów.
*   **Interakcje z przepisami:** Filtrowanie, sortowanie, paginacja, ocenianie, dodawanie do ulubionych.
*   **Personalizacja:** Zarządzanie preferencjami żywieniowymi użytkownika (diety, alergeny, wykluczenia).
*   **Dostosowanie AI:** Inicjowanie modyfikacji przepisu przez AI na podstawie presetów i preferencji.
*   **Interfejs użytkownika:** Wygląd, responsywność i użyteczność wszystkich komponentów.
*   **API:** Wszystkie publiczne i wewnętrzne punkty końcowe.

### 2.2. Funkcjonalności wyłączone z testów
*   Testowanie infrastruktury chmurowej dostawców (Supabase, Vercel/Netlify).
*   Testowanie wewnętrznej logiki zewnętrznego API OpenRouter (skupiamy się na integracji i obsłudze odpowiedzi).
*   Testy penetracyjne na dużą skalę (poza podstawową weryfikacją bezpieczeństwa).

## 3. Typy testów do przeprowadzenia

1.  **Testy jednostkowe (Unit Tests):**
    *   **Cel:** Weryfikacja poprawności działania małych, izolowanych fragmentów kodu (funkcji, modułów).
    *   **Zakres:** Funkcje narzędziowe (`utils.ts`), logika parsera przepisów (`parser.ts`), mappery danych, schematy walidacji Zod, proste hooki React.

2.  **Testy komponentów (Component Tests):**
    *   **Cel:** Sprawdzenie renderowania i działania pojedynczych komponentów React w izolacji.
    *   **Zakres:** Komponenty UI (np. `AuthCard`, `RecipeCard`, `Button`), weryfikacja ich wyglądu, stanu i reakcji na proste interakcje.

3.  **Testy integracyjne (Integration Tests):**
    *   **Cel:** Weryfikacja współpracy między różnymi częściami systemu.
    *   **Zakres:**
        *   Interakcja komponentów (np. formularz i jego pola).
        *   Komunikacja frontendu z backendem (wywołania API i obsługa odpowiedzi).
        *   Logika punktów końcowych API, która obejmuje interakcję z bazą danych Supabase.

4.  **Testy End-to-End (E2E):**
    *   **Cel:** Symulacja pełnych scenariuszy użytkownika w działającej aplikacji, naśladując rzeczywiste interakcje.
    *   **Zakres:** Pełne przepływy, np. "rejestracja -> logowanie -> utworzenie przepisu -> wylogowanie".

5.  **Testy bezpieczeństwa (Security Tests):**
    *   **Cel:** Identyfikacja potencjalnych luk bezpieczeństwa.
    *   **Zakres:**
        *   Weryfikacja reguł Row Level Security w Supabase (izolacja danych użytkowników).
        *   Testowanie podatności na ataki XSS w polach formularzy.
        *   Sprawdzenie, czy punkty końcowe API są poprawnie zabezpieczone.

6.  **Testy wydajnościowe (Performance Tests):**
    *   **Cel:** Ocena szybkości i responsywności aplikacji.
    *   **Zakres:** Pomiar czasu ładowania kluczowych stron (lista przepisów), czas odpowiedzi API dla operacji filtrowania i wyszukiwania.

7.  **Testy wizualnej regresji (Visual Regression Tests):**
    *   **Cel:** Wykrywanie niezamierzonych zmian w interfejsie użytkownika.
    *   **Zakres:** Porównywanie zrzutów ekranu kluczowych komponentów i widoków przed i po zmianach w kodzie.

## 4. Scenariusze testowe dla kluczowych funkcjonalności

| ID   | Funkcjonalność                | Scenariusz                                                                                                                                                                                                                                                         | Priorytet |
| :--- | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- |
| **AUTH** |                               |                                                                                                                                                                                                                                                                    |           |
| TC-01| Rejestracja Użytkownika       | Pomyślna rejestracja z poprawnymi danymi (unikalny e-mail, zgodne hasła). Użytkownik jest zalogowany i przekierowany.                                                                                                                                                    | Krytyczny |
| TC-02| Rejestracja Użytkownika       | Nieudana rejestracja z powodu niepoprawnych danych (zajęty e-mail, hasła niezgodne, hasło zbyt krótkie). Wyświetlenie odpowiednich komunikatów o błędach.                                                                                                               | Wysoki    |
| TC-03| Logowanie Użytkownika         | Pomyślne logowanie przy użyciu poprawnych danych e-mail/hasło oraz przez Google.                                                                                                                                                                                         | Krytyczny |
| TC-04| Logowanie Użytkownika         | Nieudane logowanie z błędnymi danymi. Testowanie mechanizmu `Rate Limiting` po wielu nieudanych próbach.                                                                                                                                                                 | Wysoki    |
| TC-05| Odzyskiwanie Hasła            | Pomyślne zainicjowanie procesu resetowania hasła i ustawienie nowego hasła.                                                                                                                                                                                               | Wysoki    |
| **RECIPE** |                               |                                                                                                                                                                                                                                                                    |           |
| TC-06| Tworzenie Przepisu            | Pomyślne przejście przez kreator: wklejenie przepisu, poprawna interpretacja przez parser, ręczna korekta danych i zapisanie przepisu.                                                                                                                                    | Krytyczny |
| TC-07| Tworzenie Przepisu            | Testowanie parsera z różnymi formatami danych wejściowych (z nagłówkami/bez, listy numerowane/punktowane, nietypowe jednostki) w celu sprawdzenia jego odporności.                                                                                                        | Wysoki    |
| TC-08| Wyświetlanie Listy Przepisów  | Poprawne działanie filtrowania, sortowania i paginacji. Wyniki są zgodne z wybranymi kryteriami.                                                                                                                                                                          | Wysoki    |
| TC-09| Edycja i Usuwanie Przepisu    | Pomyślna edycja wszystkich pól przepisu. Pomyślne usunięcie przepisu po potwierdzeniu.                                                                                                                                                                                      | Wysoki    |
| TC-10| Skalowanie porcji             | Dynamiczne przeliczanie ilości składników w widoku szczegółów działa poprawnie. Funkcja "nie skaluj" wyłącza przeliczanie dla wybranego składnika.                                                                                                                         | Średni    |
| **PREFS & AI** |                        |                                                                                                                                                                                                                                                                    |           |
| TC-11| Zarządzanie Preferencjami     | Pomyślne zapisanie i zaktualizowanie preferencji użytkownika (alergie, dieta, wykluczenia).                                                                                                                                                                               | Wysoki    |
| TC-12| Dostosowanie AI               | Pomyślne uruchomienie dostosowania AI z użyciem presetu. Aplikacja poprawnie obsługuje odpowiedź z API i przekierowuje do nowego przepisu.                                                                                                                                 | Wysoki    |
| TC-13| Dostosowanie AI               | Aplikacja poprawnie obsługuje błędy z API OpenRouter (np. timeout, błąd serwera), wyświetlając stosowny komunikat użytkownikowi.                                                                                                                                           | Wysoki    |
| **SECURITY** |                          |                                                                                                                                                                                                                                                                    |           |
| TC-14| Izolacja Danych (RLS)         | Użytkownik A nie może wyświetlić ani edytować przepisów i preferencji użytkownika B poprzez bezpośrednie odwołanie do URL lub manipulację żądaniami API.                                                                                                                   | Krytyczny |

## 5. Środowisko testowe
*   **Lokalne:** Środowisko deweloperskie z lokalną instancją aplikacji i dedykowaną bazą danych Supabase (dev). Służy do testów jednostkowych i integracyjnych.
*   **Staging:** Środowisko w pełni odzwierciedlające produkcję, z osobną bazą danych Supabase (staging). Używane do testów E2E, regresji i akceptacyjnych.
*   **Produkcja:** Środowisko docelowe. Po wdrożeniu przeprowadzane będą testy dymne (smoke tests) w celu weryfikacji kluczowych funkcjonalności.

## 6. Narzędzia do testowania
*   **Framework do testów jednostkowych i integracyjnych:** Vitest
*   **Biblioteka do testowania komponentów React:** React Testing Library
*   **Framework do testów E2E:** Playwright
*   **Testowanie API:** Wbudowane w Playwright lub dedykowane narzędzie (np. Postman).
*   **Testy wydajnościowe:** Google Lighthouse (wbudowane w przeglądarkę), k6.
*   **Testy wizualnej regresji:** Playwright lub dedykowane narzędzie (np. Percy).
*   **System śledzenia błędów:** GitHub Issues.

## 7. Harmonogram testów
Testowanie będzie prowadzone w sposób ciągły, zintegrowany z procesem deweloperskim.
*   **Testy jednostkowe i komponentów:** Pisane przez deweloperów równolegle z tworzeniem nowych funkcjonalności.
*   **Testy integracyjne i E2E:** Rozwijane w trakcie sprintu, uruchamiane automatycznie przed każdym mergem do głównej gałęzi (main/master).
*   **Testy regresji:** Pełny zestaw testów automatycznych E2E uruchamiany przed każdym wdrożeniem na środowisko produkcyjne.
*   **Testy eksploracyjne:** Przeprowadzane manualnie na środowisku Staging przed wydaniem w celu znalezienia błędów niepokrytych przez automaty.

## 8. Kryteria akceptacji testów

### 8.1. Kryteria wejścia
*   Dostępna jest stabilna wersja aplikacji na środowisku Staging.
*   Dostępna jest dokumentacja dla nowych funkcjonalności.
*   Wszystkie testy jednostkowe i integracyjne przechodzą pomyślnie.

### 8.2. Kryteria wyjścia (zakończenia testów)
*   100% testów E2E dla krytycznych ścieżek użytkownika przechodzi pomyślnie.
*   Minimum 95% wszystkich testów automatycznych przechodzi pomyślnie.
*   Brak otwartych błędów o priorytecie krytycznym i wysokim.
*   Wyniki testów wydajnościowych spełniają założone progi (np. LCP poniżej 2.5s).
*   Testy zostały zaakceptowane przez Product Ownera.

## 9. Role i odpowiedzialności
*   **Deweloperzy:**
    *   Pisanie i utrzymanie testów jednostkowych i komponentów.
    *   Naprawa błędów zgłoszonych przez zespół QA.
    *   Utrzymanie działania testów w procesie CI/CD.
*   **Inżynier QA:**
    *   Projektowanie i implementacja testów integracyjnych i E2E.
    *   Przeprowadzanie testów manualnych i eksploracyjnych.
    *   Raportowanie i weryfikacja błędów.
    *   Zarządzanie planem testów i strategią testową.
*   **Product Owner:**
    *   Definiowanie kryteriów akceptacyjnych dla funkcjonalności.
    *   Udział w testach akceptacyjnych użytkownika (UAT).

## 10. Procedury raportowania błędów
Wszystkie zidentyfikowane błędy będą raportowane w systemie GitHub Issues. Każdy raport powinien zawierać następujące informacje:
*   **Tytuł:** Zwięzły opis problemu.
*   **Środowisko:** (np. Staging, Produkcja, przeglądarka, system operacyjny).
*   **Kroki do odtworzenia:** Szczegółowa, numerowana lista kroków prowadzących do wystąpienia błędu.
*   **Obserwowany rezultat:** Co się stało.
*   **Oczekiwany rezultat:** Co powinno się stać.
*   **Dowody:** Zrzuty ekranu, nagrania wideo, logi z konsoli.
*   **Priorytet:** (Krytyczny, Wysoki, Średni, Niski).

</plan_testów>