# Dokument wymagań produktu (PRD) - HealthyMeal (MVP)

## 1. Przegląd produktu

HealthyMeal to responsywna aplikacja web wspierająca użytkowników w dostosowywaniu przepisów kulinarnych do indywidualnych potrzeb żywieniowych z pomocą AI. Produkt adresuje trzy kluczowe persony, w kolejności priorytetu: diety eliminacyjne, sportowcy oraz początkujący kucharze. MVP skupia się na prostym CRUD przepisów tekstowych, profilu preferencji żywieniowych oraz pojedynczej akcji AI „Dostosuj przepis” z podglądem różnic i walidacją bezpieczeństwa żywieniowego.

Platforma: nowoczesna responsywna aplikacja web, przeglądarki wspierane: Chrome, Safari, Edge.
Prywatność i bezpieczeństwo: wszystkie przepisy są prywatne; minimalizacja PII; szyfrowanie w tranzycie i spoczynku; sekrety w KMS; retencja danych 12 miesięcy z trwałym usunięciem.

## 2. Problem użytkownika

Dostosowywanie znalezionych w sieci przepisów do osobistych ograniczeń i celów żywieniowych jest czasochłonne i podatne na błędy. Osoby na dietach eliminacyjnych muszą identyfikować alergeny i ich synonimy w złożonych składnikach. Sportowcy chcą szybko optymalizować makro i porcje. Początkujący potrzebują prostego przepływu, który poprowadzi ich przez przygotowanie posiłku bez złożonych decyzji.

HealthyMeal rozwiązuje te problemy poprzez:

- zestrukturyzowanie wklejonego przepisu i normalizację jednostek,
- pojedynczą, kontrolowaną akcję AI „Dostosuj przepis” z parametrami zgodnymi z profilem,
- walidację po-AI pod kątem 14 alergenów UE z obsługą synonimów i składników złożonych,
- szybkie filtry i presety pod persony,
- prywatne oceny i oznaczanie ulubionych,
- przelicznik porcji z regułami zaokrągleń i flagą „nie skaluj”.

## 3. Wymagania funkcjonalne

3.1 Konta i uwierzytelnianie

- Rejestracja i logowanie e‑mailem.
- Rate limit logowania: 5 prób na 5 minut na IP; jasne komunikaty i blokada czasowa.
- Wylogowanie z poziomu UI.
- Wszystkie operacje po HTTPS; sesje zabezpieczone; wszystkie dane szyfrowane w spoczynku.
- Wszystkie przepisy i preferencje są prywatne i widoczne wyłącznie dla właściciela.

  3.2 Profil preferencji i onboarding

- Wymagane pola profilu: alergeny (lista 14 UE), lista wykluczeń, dieta.
- Opcjonalne pola: docelowe kalorie/porcje.
- Onboarding do 60 sekund z „soft gate” do akcji AI, jeśli profil niekompletny.
- Po rejestracji/pierwszym logowaniu użytkownik widzi modal z pytaniem, czy chce zasilić swoje konto przykładowymi/polecanymi przepisami (dodanymi jako prywatne kopie do jego konta).
- Użytkownik może odrzucić import („Nie teraz”) i nie powinien widzieć modala ponownie; powinna istnieć możliwość uruchomienia importu później z poziomu UI (np. ustawienia).

  3.3 Przepisy (CRUD)

- Tworzenie, odczyt, edycja i usuwanie przepisów w formie tekstowej, bez wersjonowania.
- Widok szczegółu: nagłówek z tytułem i tagami (czas, kaloryczność, dieta, ocena), sekcje: makro, kroki, czas, porcje.
- Prywatna ocena 1–5 i oznaczanie „Ulubione”.
- Sortowanie listy: domyślnie „Najnowsze”, dodatkowo „Ulubione” i „Najwyżej ocenione (moje)”; tie-breaker: updatedAt malejąco.

  3.4 Akcja AI „Dostosuj przepis”

- Pojedyncza akcja AI z parametrami: alergeny, wykluczenia, cele makro/kalorie.
- Podgląd różnic między wersją oryginalną i dostosowaną; wyraźny disclaimer prawny i UX.
- Walidacja po-AI: kontrola 14 alergenów UE, obsługa synonimów i składników złożonych; „soft block” i wskazanie niepewności.
- Błędy/limity: statusy timeout, limit-exceeded, invalid-json, validation-fail; 2–3 próby ponowienia z backoff; limit 10 dostosowań/dzień/użytkownik; reset o północy w strefie użytkownika; timeout 15–20 s.
- Brak autosave szkicu; ostrzeżenie o wyjściu tylko przy stanie „dirty” (router guard + beforeunload modal).

  3.5 Krok „Zestrukturyzuj”

- Automatyczne parsowanie wklejonego przepisu do pól: tytuł, składniki (tekst), kroki; te pola są wymagane.
- Wskaźnik confidence per pole; podświetlenie, jeśli confidence < 0,9.
- Normalizacja jednostek do g/ml/szt.; możliwość ręcznej korekty; „Zapisz” dozwolone z ostrzeżeniem.

  3.6 Wyszukiwanie, lista i filtry/presety

- Szybkie filtry na liście (np. czas, kalorie, dieta, ulubione).
- Presety w modalu „Dostosuj” (po 3 na personę), trzy globalne przypięte; zapamiętywanie ostatnio użytych w localStorage.

  3.7 Porcje i skalowanie

- Przelicznik porcji z przeskalowaniem składników i makro.
- Reguły zaokrągleń: g/ml do 1, łyżeczki do 0,25; wyświetlanie ułamków 1/2, 1/3.
- Flaga „nie skaluj” per składnik; ostrzeżenia dla wypieków.

  3.8 Oceny i ulubione

- Prywatna ocena 1–5 na przepis per użytkownik.
- Toggle „Ulubione”.
- Uwzględnienie w sortowaniu zgodnie z 3.3.

  3.9 Panel administratora: słownik alergenów i synonimów

- Konfiguracja słowników w bazie; ekran admin dostępny wyłącznie dla roli „admin” oraz przez feature flagę.
- Audyt zmian: log {kto, kiedy, co}.

  3.10 Analityka i metryki

- Dedykowana tabela logów.
- Minimalne pola: userId, recipeId oraz action/status/timestamp.
- Eventy AI: AIAdjustRequested, AIAdjustSucceeded/Failed (status: timeout, limit-exceeded, invalid-json, validation-fail).
- Event profilowy: ProfileCompleted.

  3.11 Cache/PWA i wydajność

- Cache odpowiedzi API na kliencie (store/PWA).
- Sanity-testy w Safari i Edge.

  3.12 Wymagania niefunkcjonalne i bezpieczeństwo

- Minimalizacja PII; szyfrowanie w tranzycie i spoczynku.
- Sekrety konfiguracyjne przechowywane w KMS.
- Monitoring nieudanych logowań i alerty.
- Retencja danych 12 miesięcy; trwałe usunięcie po wygaśnięciu lub na żądanie.

## 4. Granice produktu

W zakresie MVP

- Konta i profil preferencji z onboardingiem do 60 s i soft gate.
- CRUD przepisów tekstowych, prywatność per użytkownik.
- Jedna akcja AI „Dostosuj przepis” z podglądem różnic i walidacją.
- Krok „Zestrukturyzuj” z confidence i normalizacją jednostek.
- Szybkie filtry i presety; oceny i „Ulubione”; przelicznik porcji.
- Panel admin słownika alergenów (rola + feature flaga) i audyt.
- Cache/PWA, analityka minimalna, bezpieczeństwo i retencja.

Poza zakresem MVP

- Import przepisów z URL.
- Rozszerzona obsługa multimediów (zdjęcia, wideo).
- Udostępnianie przepisów, funkcje społecznościowe.
- Wersjonowanie treści przepisu.

Założenia i zależności

- Dostępność i budżet na wybrany model/dostawcę AI.
- Jednolity kontrakt JSON dla kroku „Zestrukturyzuj” (confidence, pola, walidacje).
- Wsparcie przeglądarek Chrome, Safari, Edge.

Ryzyka i kwestie nierozstrzygnięte

- Wybór modelu/dostawcy AI i limity kosztowe.
- Finalne presety filtrów per persona (wartości progowe, nazwy).
- Definicja bazy dla KPI (WAU vs. aktywni z profilem) i nazwy eventów.
- Sposób wyznaczania confidence w „Zestrukturyzuj” (kontrakt JSON i progi).
- Schemat danych przepisu (DB/API) i zasady walidacji jednostek.
- Treści i lokalizacja disclaimerów prawnych, proces „usuń moje dane”.
- Zakres sanity-testów w Safari/Edge; wymagania a11y i budżety perf (LCP/INP).

## 5. Historyjki użytkowników

US-001
Tytuł: Rejestracja konta e‑mailem
Opis: Jako użytkownik chcę założyć konto za pomocą e‑maila, aby móc zapisywać własne przepisy i preferencje.
Kryteria akceptacji:

- Formularz wymaga e‑maila i minimalnego niezbędnego zestawu danych.
- Po rejestracji tworzony jest pusty profil preferencji.
- Zgodność z polityką minimalizacji PII.
- Po sukcesie użytkownik jest zalogowany i przekierowany do onboardingu.

US-002
Tytuł: Logowanie e‑mailem
Opis: Jako użytkownik chcę zalogować się e‑mailem, aby uzyskać dostęp do swoich danych.
Kryteria akceptacji:

- Poprawne dane uwierzytelniają użytkownika i tworzą bezpieczną sesję.
- Błędne dane wyświetlają jasny komunikat bez ujawniania szczegółów.
- Komunikacja po HTTPS; sesja zabezpieczona.

US-003
Tytuł: Wylogowanie
Opis: Jako użytkownik chcę się wylogować, aby zakończyć sesję na wspólnym urządzeniu.
Kryteria akceptacji:

- Dostępny widoczny przycisk wylogowania.
- Po wylogowaniu sesja jest unieważniona i cache lokalny wrażliwych danych czyszczony.

US-004
Tytuł: Ograniczenie prób logowania
Opis: Jako system chcę ograniczyć liczbę prób logowania, aby chronić przed atakami brute-force.
Kryteria akceptacji:

- Limit 5 prób/5 min/IP.
- Przekroczenie limitu blokuje logowanie do momentu resetu okna czasowego.
- Wyświetlany jest komunikat z pozostałym czasem blokady.
- Zdarzenia nieudanych logowań są monitorowane i alarmowane.

US-005
Tytuł: Usunięcie konta i danych
Opis: Jako użytkownik chcę trwale usunąć konto, aby wycofać zgodę na przetwarzanie danych.
Kryteria akceptacji:

- Dostępna akcja „Usuń konto” z potwierdzeniem.
- Dane są oznaczane do usunięcia i trwale usuwane zgodnie z retencją (do 12 miesięcy) lub na żądanie.
- Potwierdzenie usunięcia dostarczone użytkownikowi.

US-010
Tytuł: Onboarding profilu z soft gate
Opis: Jako użytkownik podczas pierwszego logowania chcę szybko uzupełnić preferencje, aby AI mogła działać trafnie.
Kryteria akceptacji:

- Onboarding kończy się w ≤60 s dla przeciętnej ścieżki.
- Wymagane pola: alergeny (14 UE), wykluczenia, dieta.
- Opcjonalne: kalorie/porcje.
- Jeśli profil niekompletny, akcja AI wyświetla soft gate z możliwością kontynuacji z ostrzeżeniem.

US-011
Tytuł: Edycja profilu preferencji
Opis: Jako użytkownik chcę zarządzać preferencjami, aby wpływały na dostosowania przepisów.
Kryteria akceptacji:

- Walidacja listy 14 alergenów UE.
- Możliwość dodania listy wykluczeń i wyboru diety.
- Zmiany są zapisywane i wpływają na AI.

US-012
Tytuł: Ustawienia kaloryczne i porcji (opcjonalne)
Opis: Jako użytkownik chcę zadeklarować cele kaloryczne i bazową liczbę porcji.
Kryteria akceptacji:

- Pola są opcjonalne i walidowane.
- Wpływają na parametry akcji AI i przelicznik porcji.

US-013
Tytuł: Import przykładowych przepisów po pierwszym logowaniu
Opis: Jako użytkownik po rejestracji/pierwszym logowaniu chcę móc jednym kliknięciem dodać przykładowe przepisy, aby szybciej zobaczyć jak działa aplikacja.
Kryteria akceptacji:

- System wyświetla modal tylko wtedy, gdy użytkownik nie ma jeszcze przepisów i nie podjął wcześniej decyzji (import/odrzucenie).
- Modal oferuje dwie akcje: „Dodaj przykładowe przepisy” oraz „Nie teraz”.
- Po wybraniu importu, przepisy trafiają na konto użytkownika jako prywatne (widoczne tylko dla właściciela) i są dostępne na liście przepisów.
- Import jest idempotentny (ponowne kliknięcie/retry nie tworzy duplikatów).
- Po odrzuceniu („Nie teraz”) modal nie pokazuje się ponownie; użytkownik może uruchomić import później z UI.

US-020
Tytuł: Dodanie przepisu (wklej tekst)
Opis: Jako użytkownik chcę wkleić przepis tekstowy, aby go zapisać.
Kryteria akceptacji:

- Pole tekstowe akceptuje pełny przepis.
- Przy zapisie uruchamiany jest krok „Zestrukturyzuj” (lub przed zapisem jako podgląd).

US-021
Tytuł: Zestrukturyzowanie przepisu
Opis: Jako użytkownik chcę, aby przepis został zestrukturyzowany do pól i znormalizowanych jednostek.
Kryteria akceptacji:

- Pola wymagane: tytuł, składniki (tekst), kroki.
- Podświetlenia dla confidence < 0,9.
- Jednostki znormalizowane do g/ml/szt.
- Użytkownik może ręcznie poprawić dane.

US-022
Tytuł: Zapis przepisu z ostrzeżeniem
Opis: Jako użytkownik chcę zapisać przepis nawet przy niskim confidence, otrzymując ostrzeżenie.
Kryteria akceptacji:

- „Zapisz” dostępny z komunikatem ostrzegawczym, jeśli są pola z niskim confidence.
- Przepis zapisuje się prywatnie do konta.

US-023
Tytuł: Widok szczegółu przepisu
Opis: Jako użytkownik chcę zobaczyć szczegóły przepisu wraz z tagami i sekcjami.
Kryteria akceptacji:

- Widoczne: tytuł, tagi (czas, kalorie, dieta, ocena), makro, kroki, czas, porcje.
- Dostępne akcje: ocena, ulubione, skalowanie porcji, AI „Dostosuj”.

US-024
Tytuł: Edycja przepisu
Opis: Jako użytkownik chcę edytować zapisany przepis.
Kryteria akceptacji:

- Edycja pól i ponowna normalizacja jednostek.
- Zmiana updatedAt wpływa na sortowanie.

US-025
Tytuł: Usunięcie przepisu
Opis: Jako użytkownik chcę usunąć przepis.
Kryteria akceptacji:

- Akcja wymaga potwierdzenia.
- Przepis jest usuwany tylko z konta właściciela.

US-026
Tytuł: Lista przepisów z filtrami i sortowaniem
Opis: Jako użytkownik chcę przeglądać listę swoich przepisów z filtrami i sortowaniem.
Kryteria akceptacji:

- Szybkie filtry (czas, kalorie, dieta, ulubione) wpływają na wynik listy.
- Sorty: Najnowsze (domyślnie), Ulubione, Najwyżej ocenione (moje).
- Tie-breaker: updatedAt malejąco.

US-027
Tytuł: Prywatna ocena przepisu 1–5
Opis: Jako użytkownik chcę ocenić przepis w skali 1–5.
Kryteria akceptacji:

- Jedna ocena per użytkownik per przepis; edytowalna.
- Ocena wpływa na sort „Najwyżej ocenione (moje)”.

US-028
Tytuł: Oznaczenie przepisu jako „Ulubione”
Opis: Jako użytkownik chcę oznaczyć przepis jako ulubiony.
Kryteria akceptacji:

- Toggle ulubionych widoczny na liście i w szczególe.
- Filtr „Ulubione” pokazuje tylko oznaczone.

US-029
Tytuł: Skalowanie porcji i składników
Opis: Jako użytkownik chcę przeskalować porcje i składniki z rozsądnymi zaokrągleniami.
Kryteria akceptacji:

- Reguły: g/ml do 1, łyżeczki do 0,25; wyświetlanie 1/2 i 1/3.
- Składniki z flagą „nie skaluj” nie są zmieniane.
- Dla wypieków wyświetlane jest ostrzeżenie o dokładności.

US-030
Tytuł: Dostosowanie przepisu przez AI
Opis: Jako użytkownik chcę dostosować przepis do mojego profilu i celów.
Kryteria akceptacji:

- Parametry: alergeny, wykluczenia, cele makro/kalorie.
- Wyświetlany disclaimer i możliwość rezygnacji.

US-032
Tytuł: Walidacja bezpieczeństwa po-AI
Opis: Jako użytkownik chcę, aby przepis po AI był zweryfikowany pod kątem alergenów i niepewności.
Kryteria akceptacji:

- Walidacja 14 alergenów UE z obsługą synonimów i złożonych składników.
- Soft block przy niepewności z jasnym opisem pól do korekty.

US-034
Tytuł: Dzienny limit dostosowań AI
Opis: Jako system chcę ograniczyć liczbę dostosowań dziennie na użytkownika.
Kryteria akceptacji:

- Limit 10/dzień/użytkownik.
- Reset o północy w strefie użytkownika.
- Przekroczenie limitu wyświetla komunikat i blokuje akcję do resetu.

US-035
Tytuł: Ochrona szkicu AI (brak autosave)
Opis: Jako użytkownik chcę ostrzeżenie przy opuszczaniu szkicu AI, jeśli są niezapisane zmiany.
Kryteria akceptacji:

- Router guard + beforeunload modal aktywują się tylko w stanie „dirty”.
- Brak wyskakujących okien przy stanie „clean”.

US-040
Tytuł: Presety w modalu „Dostosuj” per persona
Opis: Jako użytkownik chcę szybko wybrać gotowy preset dostosowania.
Kryteria akceptacji:

- Co najmniej 3 presety per persona; 3 globalne przypięte.
- Edytowalność parametrów przed uruchomieniem.

US-041
Tytuł: Zapamiętywanie ostatnio użytych presetów
Opis: Jako użytkownik chcę, by aplikacja pamiętała ostatnie presety na moim urządzeniu.
Kryteria akceptacji:

- Ostatnie presety zapisywane w localStorage.
- Brak wpływu na inne urządzenia i użytkowników.

US-050
Tytuł: Admin – zarządzanie słownikiem alergenów i synonimów
Opis: Jako administrator chcę zarządzać słownikiem, aby walidacja była aktualna.
Kryteria akceptacji:

- Ekran dostępny tylko dla roli „admin” oraz gdy aktywna feature flaga.
- Zmiany zapisywane w bazie i wersjonowane logicznie w logach.

US-051
Tytuł: Admin – audyt zmian słownika
Opis: Jako administrator chcę widzieć, kto i kiedy zmienił słownik.
Kryteria akceptacji:

- Log zawiera co najmniej: kto, kiedy, co.
- Logi są nienadpisywalne i mają znacznik czasu.

## 6. Metryki sukcesu

Główne KPI

- 90% użytkowników posiada kompletny profil preferencji.
- 75% użytkowników generuje co najmniej jeden dostosowany przepis tygodniowo.

Definicje i pomiar

- ProfileCompleted: zdarzenie zakończenia wymaganych pól profilu.
- AIAdjustAccepted: liczba zaakceptowanych dostosowań AI per użytkownik per tydzień ISO.
- Dodatkowe pola rekomendowane w logach: model, durationMs, params (opcjonalnie) dla kontroli kosztów i jakości.
- Limity/niepowodzenia AI: rejestrowane jako AIAdjustRequested, AIAdjustSucceeded/Failed z atrybutem status (timeout, limit-exceeded, invalid-json, validation-fail); reset limitu o północy w strefie użytkownika.

Walidacja sukcesu MVP

- Osiągnięcie progów KPI w ciągu 8–12 tygodni od uruchomienia beta.
- Brak krytycznych naruszeń prywatności/bezpieczeństwa; pozytywne sanity-testy w Safari i Edge.
