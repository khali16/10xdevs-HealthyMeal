# Schemat bazy danych PostgreSQL - HealthyMeal

## 1. Lista tabel z kolumnami, typami danych i ograniczeniami

### 1.1 Tabela `users`
This table is managed by Supabase Auth.
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'UTC',
    last_login_at TIMESTAMP WITH TIME ZONE NULL
);

-- Indeksy
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
```

### 1.2 Tabela `user_preferences`
```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allergens JSONB NOT NULL DEFAULT '[]'::jsonb,
    exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
    diet VARCHAR(50) NULL,
    target_calories INTEGER NULL CHECK (target_calories > 0),
    target_servings INTEGER NULL CHECK (target_servings > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indeksy
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_allergens ON user_preferences USING GIN(allergens);
```

### 1.3 Tabela `recipes`
```sql
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    prep_time_minutes INTEGER NULL CHECK (prep_time_minutes >= 0),
    cook_time_minutes INTEGER NULL CHECK (cook_time_minutes >= 0),
    total_time_minutes INTEGER NULL CHECK (total_time_minutes >= 0),
    calories_per_serving INTEGER NULL CHECK (calories_per_serving >= 0),
    servings INTEGER NOT NULL DEFAULT 1 CHECK (servings > 0),
    is_ai_adjusted BOOLEAN DEFAULT false,
    original_recipe_id UUID NULL REFERENCES recipes(id),
    confidence_score DECIMAL(3,2) NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Indeksy
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_recipes_updated_at ON recipes(updated_at DESC);
CREATE INDEX idx_recipes_is_ai_adjusted ON recipes(is_ai_adjusted);
CREATE INDEX idx_recipes_original_recipe_id ON recipes(original_recipe_id);
CREATE INDEX idx_recipes_deleted_at ON recipes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_recipes_ingredients ON recipes USING GIN(ingredients);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_calories ON recipes(calories_per_serving);
CREATE INDEX idx_recipes_total_time ON recipes(total_time_minutes);
```

### 1.4 Tabela `recipe_ratings`
```sql
CREATE TABLE recipe_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Indeksy
CREATE INDEX idx_recipe_ratings_user_id ON recipe_ratings(user_id);
CREATE INDEX idx_recipe_ratings_recipe_id ON recipe_ratings(recipe_id);
CREATE INDEX idx_recipe_ratings_rating ON recipe_ratings(rating);
```

### 1.5 Tabela `recipe_favorites`
```sql
CREATE TABLE recipe_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Indeksy
CREATE INDEX idx_recipe_favorites_user_id ON recipe_favorites(user_id);
CREATE INDEX idx_recipe_favorites_recipe_id ON recipe_favorites(recipe_id);
```

### 1.6 Tabela `ai_adjustments`
```sql
CREATE TABLE ai_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    adjusted_recipe_id UUID NULL REFERENCES recipes(id) ON DELETE SET NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'timeout', 'limit-exceeded', 'invalid-json', 'validation-fail')),
    error_message TEXT NULL,
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0),
    duration_ms INTEGER NULL CHECK (duration_ms >= 0),
    model_used VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Indeksy
CREATE INDEX idx_ai_adjustments_user_id ON ai_adjustments(user_id);
CREATE INDEX idx_ai_adjustments_original_recipe_id ON ai_adjustments(original_recipe_id);
CREATE INDEX idx_ai_adjustments_adjusted_recipe_id ON ai_adjustments(adjusted_recipe_id);
CREATE INDEX idx_ai_adjustments_status ON ai_adjustments(status);
CREATE INDEX idx_ai_adjustments_created_at ON ai_adjustments(created_at);
```

### 1.7 Tabela `presets`
```sql
CREATE TABLE presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    access_level VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (access_level IN ('global', 'persona', 'user')),
    persona VARCHAR(50) NULL,
    is_pinned BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_presets_access_level ON presets(access_level);
CREATE INDEX idx_presets_persona ON presets(persona);
CREATE INDEX idx_presets_is_pinned ON presets(is_pinned);
CREATE INDEX idx_presets_created_by ON presets(created_by);
CREATE INDEX idx_presets_usage_count ON presets(usage_count DESC);
```

### 1.8 Tabela `allergen_dictionary`
```sql
CREATE TABLE allergen_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allergen_name VARCHAR(100) NOT NULL UNIQUE,
    synonyms JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_allergen_dictionary_name ON allergen_dictionary(allergen_name);
CREATE INDEX idx_allergen_dictionary_is_active ON allergen_dictionary(is_active);
CREATE INDEX idx_allergen_dictionary_synonyms ON allergen_dictionary USING GIN(synonyms);
```

### 1.9 Tabela `allergen_dictionary_audit`
```sql
CREATE TABLE allergen_dictionary_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allergen_id UUID NOT NULL REFERENCES allergen_dictionary(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    old_values JSONB NULL,
    new_values JSONB NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_allergen_audit_allergen_id ON allergen_dictionary_audit(allergen_id);
CREATE INDEX idx_allergen_audit_changed_by ON allergen_dictionary_audit(changed_by);
CREATE INDEX idx_allergen_audit_changed_at ON allergen_dictionary_audit(changed_at);
```

### 1.10 Tabela `analytics_logs`
```sql
CREATE TABLE analytics_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    recipe_id UUID NULL REFERENCES recipes(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Partycje miesięczne (przykład dla 2024)
CREATE TABLE analytics_logs_2024_01 PARTITION OF analytics_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE analytics_logs_2024_02 PARTITION OF analytics_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... więcej partycji według potrzeb

-- Indeksy
CREATE INDEX idx_analytics_logs_user_id ON analytics_logs(user_id);
CREATE INDEX idx_analytics_logs_recipe_id ON analytics_logs(recipe_id);
CREATE INDEX idx_analytics_logs_action ON analytics_logs(action);
CREATE INDEX idx_analytics_logs_status ON analytics_logs(status);
CREATE INDEX idx_analytics_logs_created_at ON analytics_logs(created_at);
CREATE INDEX idx_analytics_logs_metadata ON analytics_logs USING GIN(metadata);
```

### 1.11 Tabela `user_sessions`
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    session_data BYTEA NOT NULL, -- zaszyfrowane dane sesji
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
```

### 1.12 Tabela `login_attempts`
```sql
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    email VARCHAR(255) NULL,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX idx_login_attempts_success ON login_attempts(success);
```

### 1.13 Tabela `system_config`
```sql
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_system_config_key ON system_config(config_key);
CREATE INDEX idx_system_config_active ON system_config(is_active);
```

## 2. Relacje między tabelami

### 2.1 Relacje jeden-do-jednego
- `users` (1) ↔ `user_preferences` (1)

### 2.2 Relacje jeden-do-wielu
- `users` (1) → `recipes` (many)
- `users` (1) → `recipe_ratings` (many)
- `users` (1) → `recipe_favorites` (many)
- `users` (1) → `ai_adjustments` (many)
- `users` (1) → `presets` (many)
- `users` (1) → `allergen_dictionary_audit` (many)
- `users` (1) → `user_sessions` (many)
- `recipes` (1) → `recipe_ratings` (many)
- `recipes` (1) → `recipe_favorites` (many)
- `recipes` (1) → `ai_adjustments` (many) [original_recipe_id]
- `recipes` (1) → `ai_adjustments` (many) [adjusted_recipe_id]
- `allergen_dictionary` (1) → `allergen_dictionary_audit` (many)

### 2.3 Relacje wiele-do-wielu
- `users` (many) ↔ `recipes` (many) przez `recipe_favorites`
- `users` (many) ↔ `presets` (many) przez `presets.created_by`

## 3. Indeksy

### 3.1 Indeksy podstawowe
- Wszystkie klucze obce mają indeksy
- Indeksy na polach używanych w WHERE, ORDER BY, GROUP BY

### 3.2 Indeksy złożone
```sql
-- Optymalizacja zapytań sortujących przepisy
CREATE INDEX idx_recipes_user_updated ON recipes(user_id, updated_at DESC);
CREATE INDEX idx_recipes_user_rating ON recipes(user_id, calories_per_serving DESC);

-- Optymalizacja filtrów
CREATE INDEX idx_recipes_user_time_calories ON recipes(user_id, total_time_minutes, calories_per_serving);
CREATE INDEX idx_recipe_ratings_recipe_rating ON recipe_ratings(recipe_id, rating DESC);
```

### 3.3 Indeksy GIN dla JSON
- `user_preferences.allergens`
- `recipes.ingredients`
- `recipes.tags`
- `ai_adjustments.parameters`
- `allergen_dictionary.synonyms`
- `analytics_logs.metadata`

## 4. Zasady PostgreSQL (RLS)

### 4.1 Włączenie RLS
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
```

### 4.2 Polityki RLS
```sql
-- Użytkownicy widzą tylko swoje dane
CREATE POLICY users_own_data ON users FOR ALL TO authenticated USING (auth.uid() = id);

-- Preferencje użytkownika
CREATE POLICY user_preferences_own_data ON user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Przepisy użytkownika
CREATE POLICY recipes_own_data ON recipes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Oceny przepisów
CREATE POLICY recipe_ratings_own_data ON recipe_ratings FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Ulubione przepisy
CREATE POLICY recipe_favorites_own_data ON recipe_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);

-- AI adjustments
CREATE POLICY ai_adjustments_own_data ON ai_adjustments FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Sesje użytkownika
CREATE POLICY user_sessions_own_data ON user_sessions FOR ALL TO authenticated USING (auth.uid() = user_id);
```

## 5. Dodatkowe uwagi i wyjaśnienia

### 5.1 Walidacja alergenów UE
```sql
-- Funkcja walidacji 14 alergenów UE
CREATE OR REPLACE FUNCTION validate_eu_allergens(allergens JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    valid_allergens TEXT[] := ARRAY[
        'gluten', 'skorupiaki', 'jaja', 'ryby', 'orzeszki_ziemne',
        'soja', 'mleko', 'orzechy', 'seler', 'gorczyca',
        'sezam', 'dwutlenek_siarki', 'łubin', 'mięczaki'
    ];
    allergen TEXT;
BEGIN
    FOR allergen IN SELECT jsonb_array_elements_text(allergens)
    LOOP
        IF NOT (allergen = ANY(valid_allergens)) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Constraint na user_preferences
ALTER TABLE user_preferences ADD CONSTRAINT check_eu_allergens 
CHECK (validate_eu_allergens(allergens));
```

### 5.2 Automatyczne czyszczenie danych
```sql
-- Funkcja czyszczenia starych danych
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $$
BEGIN
    -- Usuwanie prób logowania starszych niż 1 godzina
    DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '1 hour';
    
    -- Usuwanie wygasłych sesji
    DELETE FROM user_sessions WHERE expires_at < NOW();
    
    -- Usuwanie danych starszych niż 12 miesięcy (soft delete)
    UPDATE users SET deleted_at = NOW() 
    WHERE deleted_at IS NULL AND created_at < NOW() - INTERVAL '12 months';
END;
$$ LANGUAGE plpgsql;

-- Harmonogram czyszczenia (wymaga pg_cron)
-- SELECT cron.schedule('cleanup-old-data', '0 * * * *', 'SELECT cleanup_old_data();');
```

### 5.3 Triggers dla automatycznych aktualizacji
```sql
-- Trigger dla updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplikacja triggerów
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recipe_ratings_updated_at BEFORE UPDATE ON recipe_ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_adjustments_updated_at BEFORE UPDATE ON ai_adjustments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_allergen_dictionary_updated_at BEFORE UPDATE ON allergen_dictionary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 5.4 Inicjalizacja danych
```sql
-- Wstawienie 14 alergenów UE do słownika
INSERT INTO allergen_dictionary (allergen_name, synonyms) VALUES
('gluten', '["pszenica", "żyto", "jęczmień", "owies", "orkisz"]'),
('skorupiaki', '["krewetki", "kraby", "homary", "langusty"]'),
('jaja', '["białko jaja", "żółtko jaja"]'),
('ryby', '["łosoś", "tuńczyk", "makrela", "sardynki"]'),
('orzeszki_ziemne', '["arachidy", "masło orzechowe"]'),
('soja', '["lecytyna sojowa", "olej sojowy"]'),
('mleko', '["laktoza", "ser", "masło", "śmietana"]'),
('orzechy', '["migdały", "orzechy włoskie", "orzechy laskowe", "pistacje"]'),
('seler', '["nasiona selera", "korzeń selera"]'),
('gorczyca', '["musztarda", "nasiona gorczycy"]'),
('sezam', '["olej sezamowy", "tahini"]'),
('dwutlenek_siarki', '["E220", "siarczyny"]'),
('łubin', '["mąka łubinowa", "nasiona łubinu"]'),
('mięczaki', '["ostrygi", "małże", "ślimaki"]');

-- Podstawowa konfiguracja systemu
INSERT INTO system_config (config_key, config_value, description) VALUES
('ai_daily_limit', '10', 'Dzienny limit dostosowań AI na użytkownika'),
('ai_timeout_seconds', '20', 'Timeout dla zapytań AI w sekundach'),
('confidence_threshold', '0.9', 'Próg confidence dla zestrukturyzowania przepisów'),
('retention_months', '12', 'Okres retencji danych w miesiącach'),
('rate_limit_attempts', '5', 'Liczba prób logowania przed blokadą'),
('rate_limit_window_minutes', '5', 'Okno czasowe dla rate limiting w minutach');
```

### 5.5 Optymalizacje wydajności
- Partycjonowanie `analytics_logs` według miesięcy
- Indeksy GIN dla pól JSON
- Indeksy złożone dla najczęstszych zapytań
- Automatyczne czyszczenie starych danych
- RLS dla bezpieczeństwa danych użytkowników
- Soft delete dla zachowania integralności referencyjnej
