## 1. Opis usługi

### Cel
Usługa **OpenRouterService** zapewnia jednolity, bezpieczny i testowalny sposób komunikacji z API OpenRouter (kompatybilnym z OpenAI Chat Completions), aby zasilać czaty oparte na LLM w aplikacji (Astro 5 + React 19 + TypeScript 5).

### Zakres odpowiedzialności
- **Budowa żądania** do OpenRouter: wybór modelu, wiadomości (system/user/assistant), parametry modelu, opcjonalny `response_format`.
- **Obsługa odpowiedzi**: parsowanie JSON, walidacja schematu (gdy używany `response_format`), mapowanie błędów na spójne typy.
- **Bezpieczeństwo i limity**: brak ekspozycji klucza API do klienta, sanityzacja logów, limity rozmiaru wejścia/wyjścia, opcjonalne rate limiting per user/session.
- **Integracja z Astro API**: endpoint po stronie serwera w `src/pages/api/*`, który wykorzystuje usługę.

### Proponowane umiejscowienie w repo
- `src/lib/openrouter/OpenRouterService.ts` – główna klasa usługi
- `src/lib/openrouter/types.ts` – typy/DTO (request/response)
- `src/lib/openrouter/errors.ts` – błędy domenowe
- `src/lib/openrouter/validation.ts` – walidacje (np. Zod) dla wejścia/wyjścia
- `src/pages/api/chat.ts` (lub podobny) – endpoint Astro używający serwisu
- `src/types.ts` – współdzielone typy (jeśli już tam trzymacie DTO)

### Konfiguracja środowiska (server-only)
Dodaj do `.env.example` (bez prefixu `PUBLIC_`, aby nie trafiło do klienta):
- `OPENROUTER_API_KEY=...`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_APP_URL=https://twoja-domena.pl` (dla nagłówka referer; w dev może być `http://localhost:4321`)
- `OPENROUTER_APP_NAME=HealthyMeal`

> Wdrożenie (DigitalOcean/Docker): wstrzyknąć zmienne środowiskowe w runtime (nie komitować sekretów).

---

## 2. Opis konstruktora

### Sygnatura (propozycja)
`new OpenRouterService(config: OpenRouterConfig, deps?: OpenRouterDeps)`

### `OpenRouterConfig` – pola
- `apiKey: string` – klucz OpenRouter.
- `baseUrl?: string` – domyślnie `https://openrouter.ai/api/v1`.
- `appUrl?: string` – URL aplikacji do nagłówka `HTTP-Referer`.
- `appName?: string` – nazwa aplikacji do nagłówka `X-Title`.
- `defaultModel: string` – domyślny model (np. `openai/gpt-4o-mini` albo inny dostępny w OpenRouter).
- `defaultParams?: ModelParams` – domyślne parametry modelu (np. `temperature`, `max_tokens`).
- `timeoutMs?: number` – timeout na request (np. 30_000).
- `allowedModels?: string[]` – allowlista modeli (zalecane dla bezpieczeństwa i kontroli kosztów).

### `OpenRouterDeps` – zależności (dla testowalności)
- `fetchImpl?: typeof fetch` – możliwość podmiany w testach.
- `now?: () => number` – dla metryk/trace.
- `logger?: { debug/info/warn/error }` – wstrzyknięcie loggera (z redakcją danych wrażliwych).

### Walidacje w konstruktorze (guard clauses)
- `apiKey` musi istnieć.
- `baseUrl` musi być poprawnym URL.
- `defaultModel` nie może być pusty; jeśli jest `allowedModels`, to `defaultModel` musi się w niej znajdować.

---

## 3. Publiczne metody i pola

### 3.1. Pola publiczne (tylko do odczytu)
- `defaultModel: string`
- `defaultParams: ModelParams`

### 3.2. `createChatCompletion(input: CreateChatCompletionInput): Promise<CreateChatCompletionResult>`
**Funkcjonalność**
- Buduje request do `POST /chat/completions`.
- Łączy `systemMessage`, `userMessage` i historię konwersacji w tablicę `messages`.
- Pozwala wymusić:
  - `model`
  - `params` (np. `temperature`, `max_tokens`, `top_p`)
  - `response_format` (structured output)
- Zwraca:
  - `text` (odpowiedź asystenta),
  - `raw` (surową odpowiedź JSON),
  - `structured` (opcjonalnie: sparsowany i zwalidowany obiekt, gdy użyty `response_format`)

**Przykłady implementacji elementów wymaganych przez OpenRouter API**

1) **Komunikat systemowy (system message)**

Przykład: stabilne zasady konwersacji (wymuszanie formatu i tonu).

```ts
const systemMessage = [
  "Jesteś asystentem HealthyMeal.",
  "Odpowiadaj krótko i rzeczowo.",
  "Jeśli prosisz o dane, zadawaj maksymalnie 1 pytanie naraz.",
].join("\n");
```

2) **Komunikat użytkownika (user message)**

```ts
const userMessage = "Ułóż jadłospis na 3 dni, 2000 kcal dziennie, bez orzechów.";
```

3) **Ustrukturyzowane odpowiedzi przez `response_format` (JSON schema)**

Wzór wymagany:
`{ type: 'json_schema', json_schema: { name: [schema-name], strict: true, schema: [schema-obj] } }`

Przykład A: prosta odpowiedź z listą pytań doprecyzowujących.

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "ClarifyingQuestions",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        questions: {
          type: "array",
          items: { type: "string" },
          minItems: 0,
          maxItems: 3,
        },
      },
      required: ["questions"],
    },
  },
} as const;
```

Przykład B: wygenerowanie planu posiłków (konkretny, ograniczony format).

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "MealPlan3Days",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        days: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              dayIndex: { type: "integer", minimum: 1, maximum: 3 },
              meals: {
                type: "array",
                minItems: 3,
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    kcal: { type: "integer", minimum: 0, maximum: 3000 },
                    ingredients: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 1,
                      maxItems: 30,
                    },
                  },
                  required: ["name", "kcal", "ingredients"],
                },
              },
              totalKcal: { type: "integer", minimum: 0, maximum: 5000 },
            },
            required: ["dayIndex", "meals", "totalKcal"],
          },
        },
      },
      required: ["days"],
    },
  },
} as const;
```

Przykład C: odpowiedź “nawigacyjna” dla czatu (akcja + dane).

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "ChatDirective",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["ASK", "SUGGEST", "REFUSE"] },
        message: { type: "string" },
        missingFields: {
          type: "array",
          items: { type: "string" },
          minItems: 0,
          maxItems: 10,
        },
      },
      required: ["action", "message", "missingFields"],
    },
  },
} as const;
```

4) **Nazwa modelu**

```ts
const model = "openai/gpt-4o-mini";
// alternatywnie: "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash", itd.
```

5) **Parametry modelu**

```ts
const params = {
  temperature: 0.2,
  max_tokens: 800,
  top_p: 1,
  // opcjonalnie: frequency_penalty, presence_penalty, seed, stop, itp. (zależnie od modelu)
};
```

**Uwagi dot. `response_format`**
- Używaj `strict: true` i `additionalProperties: false` dla przewidywalności.
- Waliduj wynik po stronie serwera (np. Zod lub walidator JSON Schema) i obsługuj przypadki, gdy model zwróci niepoprawny JSON.
- Wprowadź fallback: jeśli model/odpowiedź nie wspiera structured output, przełącz się na tryb tekstowy i zwróć błąd domenowy “StructuredOutputNotSupported” albo “StructuredOutputInvalid”.

### 3.3. `createChatCompletionText(input: TextOnlyInput): Promise<string>`
**Funkcjonalność**
- Cienki wrapper na `createChatCompletion`, wymuszający brak `response_format`.
- Zwraca wyłącznie tekst (`choices[0].message.content`) i mapuje brak treści na błąd domenowy.

**Kiedy używać**
- UI czatu, gdy structured output nie jest wymagany (najprostsza integracja).

### 3.4. `createChatCompletionStructured<T>(input: StructuredInput<T>): Promise<T>`
**Funkcjonalność**
- Wymusza `response_format` typu `json_schema`.
- Parsuje odpowiedź do JSON (z mechanizmem naprawczym typu: “przytnij do pierwszego/ostatniego nawiasu klamrowego” – ostrożnie).
- Waliduje wynik po stronie serwera (np. Zod), a w razie błędu:
  - rzuca `StructuredOutputInvalidError`, albo
  - uruchamia 1 szybki retry z ostrzejszym system promptem (opcjonalnie).

**Wskazówka**
- Jeśli w aplikacji macie wiele schematów, trzymaj je w katalogu `src/lib/openrouter/schemas/*` i importuj w endpointach.

### 3.5. `healthCheck(): Promise<{ ok: boolean; details?: string }>`
**Funkcjonalność**
- Minimalny request (np. “ping” przez prostą prośbę z bardzo niskim `max_tokens`) do wybranego modelu.
- Używane w CI/CD lub monitoringu (DigitalOcean) do szybkiej diagnozy konfiguracji.

---

## 4. Prywatne metody i pola

### 4.1. Prywatne pola (propozycja)
- `private readonly apiKey: string`
- `private readonly baseUrl: string`
- `private readonly appUrl?: string`
- `private readonly appName?: string`
- `private readonly timeoutMs: number`
- `private readonly allowedModels?: Set<string>`
- `private readonly fetchImpl: typeof fetch`
- `private readonly logger: Logger`

### 4.2. Prywatne metody (propozycja)

1) `private buildHeaders(): HeadersInit`
- Ustawia:
  - `Authorization: Bearer ${apiKey}`
  - `Content-Type: application/json`
  - `HTTP-Referer: ${appUrl}` (jeśli podane)
  - `X-Title: ${appName}` (jeśli podane)
- Nigdy nie loguje `Authorization`.

2) `private assertModelAllowed(model: string): void`
- Jeśli jest `allowedModels`, blokuje model spoza allowlisty (błąd domenowy `ModelNotAllowedError`).

3) `private buildMessages(input): ChatMessage[]`
- Składa tablicę `messages` w kolejności:
  1. `system` (opcjonalnie)
  2. historia rozmowy (opcjonalnie)
  3. bieżący `user` (wymagany)
- Odcina zbyt długie historie (limit tokenów/znaków) albo stosuje strategię streszczenia (na później).

4) `private async postJson<T>(path: string, body: unknown): Promise<T>`
- Wysyła request na `${baseUrl}${path}` z `AbortController` (timeout).
- Obsługuje `response.ok === false` i mapuje błąd na domenowy (patrz sekcja 5).

5) `private extractAssistantText(rawResponse): string`
- Bezpiecznie wyciąga `choices[0].message.content`.
- Gdy brak treści: rzuca `EmptyModelResponseError`.

6) `private safeJsonParse(text: string): unknown`
- Używane do structured output (jeśli model zwróci JSON jako string w `content`).
- Stosuje minimalne heurystyki (np. trim, wycięcie otoczek) i kończy się błędem, jeśli nie da się sparsować.

7) `private redactForLogs(input: unknown): unknown`
- Redaguje dane wrażliwe (klucze, tokeny, potencjalnie dane zdrowotne użytkownika) przed logowaniem.

---

## 5. Obsługa błędów

### Podejście
- Stosuj **błędy domenowe** (`OpenRouterError` + wyspecjalizowane klasy), aby UI/API mogły zwracać stabilne kody i komunikaty.
- Zawsze zwracaj użytkownikowi komunikat “bezpieczny” (bez stack trace, bez promptów, bez sekretów).
- Loguj pełniejsze szczegóły tylko po stronie serwera i tylko po redakcji.

### Potencjalne scenariusze błędów (numerowane)

1) **Brak konfiguracji** (np. `OPENROUTER_API_KEY` undefined).
- Objaw: błąd podczas startu lub pierwszego użycia serwisu.

2) **Niepoprawny request od klienta** (brak `userMessage`, zbyt długie pole, zły typ `params`).
- Objaw: walidacja wejścia endpointu nie przechodzi.

3) **Model spoza allowlisty / brak modelu**.
- Objaw: błąd domenowy jeszcze przed requestem lub błąd HTTP z OpenRouter.

4) **Timeout / anulowanie** (AbortController).
- Objaw: request nie kończy się w `timeoutMs`.

5) **Błędy sieciowe** (DNS, brak internetu, reset połączenia).
- Objaw: `fetch` rzuca wyjątek.

6) **HTTP 401/403** (zły klucz, brak uprawnień).
- Objaw: odpowiedź nie-2xx.

7) **HTTP 429** (rate limit / limity kosztów).
- Objaw: odpowiedź nie-2xx, możliwy nagłówek `Retry-After`.

8) **HTTP 5xx** (awaria OpenRouter lub upstream modelu).
- Objaw: odpowiedź nie-2xx.

9) **Odpowiedź nie jest JSON** (np. błąd proxy, HTML).
- Objaw: `response.json()` rzuca.

10) **Brak spodziewanej struktury odpowiedzi** (`choices` puste, brak `content`).
- Objaw: `EmptyModelResponseError`.

11) **Structured output niepoprawny** (JSON nie parsuje się / nie przechodzi walidacji).
- Objaw: `StructuredOutputInvalidError`.

12) **Structured output nieobsługiwany** (model ignoruje `response_format`).
- Objaw: tekst zamiast JSON, częste w tańszych modelach; decyzja o fallback.

13) **Przekroczenie limitów tokenów / kontekstu**.
- Objaw: błąd 400/422 lub błąd upstream; konieczne skrócenie historii lub `max_tokens`.

14) **Zablokowana treść / policy refusal**.
- Objaw: odpowiedź modelu odmawia; w structured output można mapować na `REFUSE`.

### Zalecane mapowanie na statusy API (Astro endpoint)
- 1 → 500 (misconfig) + log “error”
- 2 → 400 (bad request)
- 3 → 400 lub 403 (w zależności od źródła)
- 4/5 → 504 lub 502
- 6 → 502 (upstream auth) + alert dla devops
- 7 → 429 (propaguj retry-after jeśli jest)
- 8 → 502
- 9/10/11/12 → 502 (upstream invalid) + ewentualnie 200 z fallback (decyzja produktowa)
- 13 → 400 (jeśli wynika z wejścia) lub 502 (jeśli upstream)
- 14 → 200 z treścią odmowy albo 403/422 (decyzja produktowa)

---

## 6. Kwestie bezpieczeństwa

1) **Klucz API tylko po stronie serwera**
- Nie używaj `PUBLIC_` dla `OPENROUTER_API_KEY`.
- Wszystkie wywołania OpenRouter idą przez `src/pages/api/*`.

2) **Autoryzacja użytkownika w endpointach**
- Endpoint czatu powinien wymagać sesji Supabase (np. cookie-based auth).
- Brak sesji → 401.

3) **Kontrola kosztów**
- Allowlista modeli (`allowedModels`).
- Hard cap na `max_tokens`, limit długości `messages`.
- Rate limiting per user (np. w Supabase: tabela limitów, albo prosty in-memory w MVP).

4) **Redakcja logów**
- Nigdy nie loguj `Authorization`, pełnych promptów ani danych zdrowotnych.
- Loguj metryki: model, czas, status, przycięte długości wejścia/wyjścia, identyfikator użytkownika (hash/uuid).

5) **Prompt injection i zaufanie do danych**
- Traktuj treści użytkownika jako nieufne.
- W structured output zawsze waliduj i ustawiaj `additionalProperties: false`.
- Nie wykonuj “akcji” po stronie serwera na podstawie samego tekstu modelu bez dodatkowej walidacji/reguł.

6) **Transport**
- Zawsze HTTPS w produkcji.

---

## 7. Plan wdrożenia krok po kroku

### Krok 1: Konfiguracja środowiska
- Dodaj wymagane zmienne do `.env.example`:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_BASE_URL`
  - `OPENROUTER_APP_URL`
  - `OPENROUTER_APP_NAME`
- W runtime (Docker/DigitalOcean) ustaw realne wartości jako sekrety/zmienne środowiskowe.

### Krok 2: Definicje typów i błędów
- Utwórz `src/lib/openrouter/types.ts`:
  - `ChatMessage` (`role: 'system' | 'user' | 'assistant'`, `content: string`)
  - `ModelParams` (np. `temperature?: number`, `max_tokens?: number`, `top_p?: number`)
  - `CreateChatCompletionInput`, `CreateChatCompletionResult`
- Utwórz `src/lib/openrouter/errors.ts`:
  - `OpenRouterError` (bazowy)
  - `OpenRouterConfigError`, `OpenRouterHttpError`, `OpenRouterTimeoutError`, `StructuredOutputInvalidError`, `ModelNotAllowedError`, itd.

### Krok 3: Walidacje wejścia/wyjścia
- Utwórz `src/lib/openrouter/validation.ts`:
  - walidacja inputu do serwisu i endpointu (np. Zod)
  - walidacja structured output (np. przekazywany Zod schema per use-case)

### Krok 4: Implementacja `OpenRouterService`
- Utwórz `src/lib/openrouter/OpenRouterService.ts` z:
  - konstruktorem z guard clauses,
  - `createChatCompletion`, `createChatCompletionText`, `createChatCompletionStructured`, `healthCheck`,
  - prywatnymi helperami: headers, timeout, mapowanie błędów, ekstrakcja treści, redakcja logów.

### Krok 5: Endpoint Astro (server route)
- Utwórz `src/pages/api/chat.ts` (POST):
  - waliduj body requestu (np. `{ userMessage, history?, model?, params?, response_format? }`)
  - sprawdź sesję Supabase (401 jeśli brak)
  - wywołaj `OpenRouterService`
  - zwróć `{ text, structured?, requestId? }` (bez surowych danych wrażliwych)

### Krok 6: Integracja z UI (React)
- UI wysyła request do `/api/chat` (nigdy bezpośrednio do OpenRouter).
- Dla structured output: UI używa `structured` i renderuje wynik (np. plan posiłków).
- Dla trybu tekstowego: UI renderuje `text`.