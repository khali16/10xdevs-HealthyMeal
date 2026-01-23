# REST API Plan

## 1. Resources

- Users (auth) → Supabase Auth (`auth.users`); application endpoints expose `GET /me` only
- UserPreferences → `user_preferences`
- Recipes → `recipes`
- RecipeTemplates → `recipe_templates` (seeded example/recommended recipes; used to create private user copies)
- RecipeRatings → `recipe_ratings`
- RecipeFavorites → `recipe_favorites`
- AIAdjustments (jobs) → `ai_adjustments`
- Presets → `presets`
- AllergenDictionary (admin) → `allergen_dictionary`
- AllergenDictionaryAudit (admin, read-only) → `allergen_dictionary_audit`
- AnalyticsLogs → `analytics_logs`
- SystemConfig (admin) → `system_config`
- LoginAttempts (internal) → `login_attempts`
- UserSessions (internal) → `user_sessions`
- UserOnboarding → `user_onboarding`

Notes:
- All tables have RLS enabled per schema; access is restricted to the owner (`auth.uid()`), except admin endpoints which require `role=admin` and service-role DB access for write operations that bypass RLS as needed.
- Important indexes leveraged by API queries:
  - `recipes(updated_at DESC)`, `recipes(user_id)`, `recipes(calories_per_serving)`, `recipes(total_time_minutes)`
  - GIN on `recipes.ingredients`, `recipes.tags`; GIN on `user_preferences.allergens`
  - AI jobs: `ai_adjustments(status)`, `ai_adjustments(created_at)`
  - Analytics partitioned monthly, indexes on `created_at`, `user_id`, `action`, `status`

## 2. Endpoints

Conventions
- Base path: `/api`
- Auth: Bearer JWT (Supabase) required unless noted
- Responses use envelopes:
  - Success (single): `{ "data": { ... }, "meta"?: { ... } }`
  - Success (list): `{ "data": [ ... ], "meta": { page, page_size, total?, has_next } }`
  - Error: `{ "error": { code, message, details?, fieldErrors? } }`
- Pagination: `page` (default 1), `page_size` (default 20, max 100)
- Sorting: `sort` enum per endpoint; `order` in {`asc`,`desc`} when allowed
- Idempotency for mutation endpoints (optional but recommended): header `Idempotency-Key`

### 2.1 Auth and Identity

Supabase handles sign-up/sign-in client-side. Server provides identity helper and profile completeness check.

- GET /api/me
  - Description: Return authenticated user summary and profile completeness
  - Query: none
  - Response:
    ```json
    {
      "data": {
        "user": {
          "id": "uuid",
          "email": "user@example.com",
          "last_login_at": "2025-01-20T12:34:56Z",
          "timezone": "Europe/Warsaw"
        },
        "profile": {
          "has_preferences": true,
          "is_complete": true,
          "diet": "vegan" | null,
          "allergens_count": 3,
          "exclusions_count": 2
        },
        "onboarding": {
          "sample_recipes": {
            "state": "unseen" | "dismissed" | "imported",
            "should_prompt": true,
            "templates_available_count": 12
          }
        }
      }
    }
    ```
  - Success: 200
  - Errors: 401 (unauthenticated)

- POST /api/onboarding/sample-recipes
  - Description: Handle first-login prompt for importing example recipes into user's private list
  - Request:
    ```json
    { "action": "import" | "dismiss" }
    ```
  - Behavior:
    - `import`: copies active `recipe_templates` into `recipes` for current user (private copies), sets `recipes.template_id`, and marks onboarding as imported (idempotent)
    - `dismiss`: marks onboarding as dismissed; prompt should not reappear by default
  - Response (200):
    ```json
    {
      "data": {
        "state": "dismissed" | "imported",
        "imported_count": 12
      }
    }
    ```
  - Errors: 401, 422 (invalid action)

### 2.2 User Preferences

- GET /api/user/preferences
  - Description: Get current user preferences (one-to-one)
  - Response (200):
    ```json
    {
      "data": {
        "id": "uuid",
        "user_id": "uuid",
        "allergens": ["gluten", "orzechy"],
        "exclusions": ["papryka"],
        "diet": "vegan",
        "target_calories": 2200,
        "target_servings": 2,
        "created_at": "2025-01-20T12:34:56Z",
        "updated_at": "2025-01-21T09:00:00Z"
      }
    }
    ```
  - Errors: 404 (not found if not created), 401

- POST /api/user/preferences
  - Description: Create preferences (if missing). Enforces unique per user.
  - Request:
    ```json
    {
      "allergens": ["gluten", "soja"],
      "exclusions": ["papryka"],
      "diet": "vegan",
      "target_calories": 2200,
      "target_servings": 2
    }
    ```
  - Response: 201 with preferences object (as above)
  - Errors: 409 (already exists), 422 (invalid allergens per EU list), 401

- PUT /api/user/preferences
  - Description: Upsert preferences. Creates if absent; otherwise updates.
  - Request: same as POST; partials allowed? No (use PATCH semantics inside server)
  - Response: 200
  - Errors: 422 (validation), 401

Validation
- `allergens` validated against DB function `validate_eu_allergens` and dictionary synonyms
- `target_calories`, `target_servings` must be positive integers

### 2.3 Recipes

- GET /api/recipes
  - Description: List current user recipes with filters
  - Query:
    - `page`, `page_size`
    - Filters (all optional):
      - `diet` (string)
      - `max_calories` (int)
      - `max_total_time` (int, minutes)
      - `favorite` (bool)
      - `tag:*` (e.g., `tag.course=dinner`) for JSON tag filters
      - `q` (full-text over ingredients/title via trigram/ILIKE; best-effort)
    - Sorting: `sort` in {`newest` (default), `favorites`, `top_rated`}; `order` when applicable
  - Response (200): list with meta
  - Errors: 401

- POST /api/recipes
  - Description: Create recipe (structured)
  - Request:
    ```json
    {
      "title": "Tofu Stir Fry",
      "ingredients": [
        { "text": "200 g tofu", "unit": "g", "amount": 200, "no_scale": false },
        { "text": "1 tbsp soy sauce", "unit": "tbsp", "amount": 1, "no_scale": false }
      ],
      "steps": ["Press tofu", "Stir fry"],
      "tags": { "diet": "vegan", "course": "dinner" },
      "prep_time_minutes": 10,
      "cook_time_minutes": 15,
      "total_time_minutes": 25,
      "calories_per_serving": 450,
      "servings": 2
    }
    ```
  - Response (201): recipe object
  - Errors: 422 (invalid payload), 401

- GET /api/recipes/{id}
  - Description: Get recipe by id (owner-only)
  - Response (200): recipe with computed `rating` (user-specific), and `is_favorite`
  - Errors: 404, 401

- PATCH /api/recipes/{id}
  - Description: Update any recipe details/fields (partial allowed). This is the only endpoint that persists recipe edits.
  - Request: any subset of fields below. Semantics: JSON Merge Patch for objects (merge), arrays are full-replace; omitted fields unchanged; `null` clears nullable fields.
    - Updatable fields: `title`, `ingredients` (array replace), `steps` (array replace), `tags` (object merge), `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`, `calories_per_serving`, `servings`, `is_ai_adjusted` (server-managed; ignored), `original_recipe_id` (server-managed; ignored), `confidence_score` (server-managed; ignored)
    - If `total_time_minutes` omitted, server may recalculate from prep+cook when both provided
  - Response: 200 with updated recipe
  - Errors: 404, 422, 401

- DELETE /api/recipes/{id}
  - Description: Soft delete (sets `deleted_at`); DB has partial index to filter out deleted
  - Response: 204
  - Errors: 404, 401

Helpers
- POST /api/recipes/structure
  - Description: Parse raw recipe text into structured fields with confidence per field
  - Request:
    ```json
    { "raw": "<pasted recipe text>", "normalize_units": true }
    ```
  - Response (200):
    ```json
    {
      "data": {
        "title": { "value": "Tofu Stir Fry", "confidence": 0.96 },
        "ingredients": [ { "text": "200 g tofu", "unit": "g", "amount": 200, "confidence": 0.95 } ],
        "steps": [ { "text": "Press tofu", "confidence": 0.92 } ],
        "warnings": ["low confidence on step 2" ]
      }
    }
    ```
  - Errors: 422 (cannot parse), 401

### 2.4 Ratings and Favorites

- PUT /api/recipes/{id}/rating
  - Description: Create/update user rating (1–5)
  - Request:
    ```json
    { "rating": 4 }
    ```
  - Response (200): `{ "data": { "recipe_id": "uuid", "rating": 4 } }`
  - Errors: 422 (out of range), 404, 401

- DELETE /api/recipes/{id}/rating
  - Description: Remove rating
  - Response: 204
  - Errors: 404, 401

- PUT /api/recipes/{id}/favorite
  - Description: Set favorite flag
  - Request:
    ```json
    { "favorite": true }
    ```
  - Response (200): `{ "data": { "recipe_id": "uuid", "favorite": true } }`
  - Errors: 404, 401

### 2.5 AI Adjustments (Jobs)

- POST /api/recipes/{id}/ai-adjustments
  - Description: Start an AI adjustment job using user preferences and provided parameters
  - Pre-conditions:
    - Daily per-user limit loaded from `system_config.ai_daily_limit` (default 10)
    - Timeout from `system_config.ai_timeout_seconds` (default 20)
  - Request:
    ```json
    {
      "parameters": {
        "avoid_allergens": true,
        "use_exclusions": true,
        "target_calories": 550,
        "presets": ["vegan-protein"]
      },
      "model": "openrouter/anthropic/claude-3.5"
    }
    ```
  - Response (202):
    ```json
    {
      "data": {
        "job_id": "uuid",
        "status": "pending"
      }
    }
    ```
  - Errors: 429 (limit-exceeded), 422 (invalid parameters), 404 (recipe not found), 401

- GET /api/ai-adjustments/{job_id}
  - Description: Poll job status and, when completed, return adjusted recipe reference
  - Response (200):
    ```json
    {
      "data": {
        "id": "uuid",
        "status": "processing|completed|failed|timeout|invalid-json|validation-fail|limit-exceeded",
        "error_message": null,
        "duration_ms": 15324,
        "model_used": "openrouter/...",
        "original_recipe_id": "uuid",
        "adjusted_recipe_id": "uuid" // when completed
      }
    }
    ```
  - Errors: 404, 401

- GET /api/recipes/{id}/ai-adjustments
  - Description: List jobs for a recipe (owner only)
  - Query: `status` optional, pagination
  - Response: list with meta
  - Errors: 404, 401

Notes
- Server performs post-AI validation against 14 EU allergens (with synonyms) and rejects with `validation-fail` when violations detected (soft-block in UI).
- Retries with capped backoff up to `max_retries` in table (default 3). Statuses recorded per schema.
- Analytics events emitted: `AIAdjustRequested`, `AIAdjustSucceeded|Failed` with `status` and `duration_ms`.

### 2.6 Presets

- GET /api/presets
  - Description: List presets visible to user
  - Query:
    - `access_level` in {`user`,`persona`,`global`} (default: all)
    - `persona` (string)
    - `pinned` (bool)
    - Sorting: `sort=usage_desc|recent` (default `usage_desc`)
    - Pagination
  - Response: list

- POST /api/presets
  - Description: Create user preset; `created_by` set to `auth.uid()`
  - Request:
    ```json
    {
      "name": "Vegan Protein Boost",
      "description": "High protein vegan adjustments",
      "parameters": { "protein_min": 25 },
      "access_level": "user",
      "persona": null,
      "is_pinned": false
    }
    ```
  - Response: 201 with preset
  - Errors: 422, 401

- PATCH /api/presets/{id}
  - Description: Update own preset; admin can update global/persona presets
  - Response: 200
  - Errors: 404, 403, 401

- DELETE /api/presets/{id}
  - Description: Delete own preset; admin for global/persona presets
  - Response: 204
  - Errors: 404, 403, 401

### 2.7 Allergen Dictionary (Admin)

- GET /api/admin/allergens
  - Description: List allergen dictionary entries
  - Query: `is_active` (bool), `q` (ILIKE name or synonyms), pagination
  - Response: list

- POST /api/admin/allergens
  - Description: Create allergen entry; write audit (`created`)
  - Request:
    ```json
    {
      "allergen_name": "gluten",
      "synonyms": ["pszenica", "żyto"],
      "is_active": true
    }
    ```
  - Response: 201
  - Errors: 409 (duplicate name), 422, 403/401

- PATCH /api/admin/allergens/{id}
  - Description: Update entry; write audit (`updated`)
  - Response: 200
  - Errors: 404, 422, 403/401

- DELETE /api/admin/allergens/{id}
  - Description: Soft delete or deactivate; write audit (`deleted`)
  - Response: 204
  - Errors: 404, 403/401

- GET /api/admin/allergens/{id}/audit
  - Description: List audit entries for allergen
  - Response: list

### 2.8 Analytics

- POST /api/analytics/logs
  - Description: Append analytics event
  - Request:
    ```json
    {
      "action": "AIAdjustRequested",
      "status": "pending",
      "recipe_id": "uuid",
      "metadata": { "model": "...", "duration_ms": 0 }
    }
    ```
  - Response: 202
  - Notes: Server-side validation white-lists actions; partitioned inserts by month

### 2.9 System Config (Admin)

- GET /api/admin/system-config
  - Description: List active config entries
  - Response: list

- PUT /api/admin/system-config/{config_key}
  - Description: Upsert a config value
  - Request:
    ```json
    { "config_value": 10, "description": "Daily AI limit" }
    ```
  - Response: 200
  - Errors: 422, 403/401

### 2.10 Internal/Operational

- POST /api/internal/login-attempt
  - Description: Record login attempt outcome; used by rate limiter telemetry
  - Auth: none (IP-based); protected by HMAC shared secret header
  - Request:
    ```json
    { "email": "user@example.com", "success": false, "failure_reason": "invalid-credentials" }
    ```
  - Response: 202

- DELETE /api/internal/sessions/expired (admin)
  - Description: Purge expired user sessions
  - Response: 202

## 3. Authentication and Authorization

- Identity: Supabase JWT in `Authorization: Bearer <token>`; Astro server verifies via Supabase server client.
- RLS: Enforced on `user_preferences`, `recipes`, `recipe_ratings`, `recipe_favorites`, `ai_adjustments`, `user_sessions` with `USING (auth.uid() = user_id)` per schema. API relies on RLS as primary data access control.
- Admin: Endpoints under `/api/admin/*` require `role=admin` claim (JWT) and are executed with service-role DB client on the server. Additionally gated by feature flag for admin UI.
- CSRF: API is JSON/REST with Bearer tokens; not cookie-authenticated. CSRF not applicable; still validate `Origin`/`Referer` for admin mutations.
- Idempotency: For POST that create resources (recipes, ai-adjustments, presets), support `Idempotency-Key` to safely retry.

## 4. Validation and Business Logic

Global
- Input validation with TypeScript schemas (e.g., Zod) in API routes; respond 422 with `fieldErrors`.
- Errors: standard codes 400, 401, 403, 404, 409, 422, 429, 500, 504.
- Caching: `GET` endpoints support `ETag`/`If-None-Match`; lists support `Cache-Control: private, max-age=30` and `If-Modified-Since` best-effort.

User Preferences
- EU allergens validation via DB function `validate_eu_allergens(allergens)`; reject 422 if false.
- `target_calories` > 0; `target_servings` > 0.

Recipes
- `servings` > 0; time and calories fields ≥ 0; soft delete uses `deleted_at`.
- Filtering uses indexes: `max_calories` → `recipes(calories_per_serving)`; `max_total_time` → `recipes(total_time_minutes)`; sorting `newest` via `updated_at DESC` index; favorites join on `recipe_favorites`.
- Text search `q` uses ILIKE on `title` and GIN on `ingredients` for basic inclusion; may degrade to ILIKE both.
- Scaling follows rounding rules: grams/ml to 1 decimal, teaspoons to 0.25; `no_scale` respected.

Ratings and Favorites
- Ratings constrained 1–5; unique per user/recipe. Upsert semantics on PUT. Conflicts map to 409 only on impossible states; otherwise handled with UPSERT.
- Favorites unique per user/recipe; PUT with `favorite=false` deletes the record.

AI Adjustments
- Enforce per-user daily limit from `system_config.ai_daily_limit` using `analytics_logs` or job counts within day (by user timezone when available; fallback UTC).
- Timeout `ai_timeout_seconds`; set job `status` to `timeout` when exceeded.
- Retries: incremental backoff (e.g., 1s, 3s, 7s) up to `max_retries` column.
- Post-AI validation:
  - Parse adjusted recipe JSON; if invalid shape → `invalid-json`.
  - Check allergens against dictionary including synonyms and composite ingredients.
  - On violation → `validation-fail`; return details in `error_message`; UI soft-blocks.
- On success, persist adjusted recipe with `is_ai_adjusted=true`, set `original_recipe_id`, `confidence_score` when available, and link in job via `adjusted_recipe_id`.
- Emit analytics events with `action`, `status`, `duration_ms`, `model`.

Presets
- `access_level` in {`global`, `persona`, `user`}; `persona` required for `persona` level.
- `usage_count` incremented when a preset is applied to AI adjust; pinned presets surfaced via query.

Allergen Dictionary (Admin)
- Unique `allergen_name` (409 on duplicate); synonyms stored as JSON array; `is_active` toggles availability in validation.
- Write audit log on create/update/delete with actor, old/new values, timestamp.

Analytics
- Allowed actions: `AIAdjustRequested`, `AIAdjustSucceeded`, `AIAdjustFailed`, `ProfileCompleted` (extendable). Partitioned inserts per month table; indexes on `created_at`, `user_id`, `action`, `status`.
  - Additional recommended actions: `SampleRecipesPrompted`, `SampleRecipesImported`, `SampleRecipesDismissed`

System Config
- Keys include: `ai_daily_limit`, `ai_timeout_seconds`, `confidence_threshold`, `retention_months`, `rate_limit_attempts`, `rate_limit_window_minutes`.
- Values stored as JSON; API enforces expected types at boundary.

Security and Rate Limiting
- Rate limits in Astro middleware:
  - Auth attempts (if proxied): 5 attempts / 5 minutes / IP; log to `login_attempts` and block with remaining time.
  - AI Adjustments: 10/day/user; also 1 request/5s/user burst to prevent spam.
  - Global: 120 requests/min/IP for authenticated API; 30 requests/min/IP for unauthenticated.
- Admin endpoints require both JWT `role=admin` and server-side feature flag; reject with 403 otherwise.
- Secrets: OpenRouter API keys stored server-side; never exposed to client.
- Data retention: purge or soft-delete per `retention_months`; background job to enforce.

Error Catalog (common examples)
- 400 Bad Request: malformed JSON
- 401 Unauthorized: missing/invalid token
- 403 Forbidden: lacking privileges (non-admin to admin route)
- 404 Not Found: resource not found or not owned (RLS masked)
- 409 Conflict: uniqueness violations (e.g., duplicate allergen name)
- 422 Unprocessable Entity: validation errors (allergen not in 14-EU list)
- 429 Too Many Requests: rate limit exceeded (login or AI)
- 500 Internal Server Error: unexpected
- 504 Gateway Timeout: AI processing exceeded timeout

Appendix: Sorting and Filtering Details
- Recipes `sort`:
  - `newest`: `updated_at DESC`
  - `favorites`: join `recipe_favorites`, order by `created_at DESC`, tie-breaker `updated_at DESC`
  - `top_rated`: join `recipe_ratings` (user’s rating), order by `rating DESC`, tie-breaker `updated_at DESC`
- Filters map to indexes: calories/time; tags via JSON path; ingredients via GIN/ILIKE hybrid.


