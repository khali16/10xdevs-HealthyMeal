-- =============================================================================
-- Migration: Create HealthyMeal Database Schema
-- Purpose: Initialize complete database schema for HealthyMeal application
-- Tables: users, user_preferences, recipes, recipe_ratings, recipe_favorites,
--         ai_adjustments, presets, allergen_dictionary, allergen_dictionary_audit,
--         analytics_logs, user_sessions, login_attempts, system_config
-- Special Considerations: RLS enabled, JSONB fields indexed, partitioned analytics
-- =============================================================================

-- =============================================================================
-- 1. CREATE TABLES
-- =============================================================================

-- users table - managed by supabase auth
-- note: this table structure is provided for reference but users table
-- is typically managed by supabase auth system
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) unique not null,
    password_hash varchar(255) not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone null,
    is_active boolean default true,
    timezone varchar(50) default 'utc',
    last_login_at timestamp with time zone null
);

-- user_preferences table - stores user dietary preferences and restrictions
create table if not exists user_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    allergens jsonb not null default '[]'::jsonb,
    exclusions jsonb not null default '[]'::jsonb,
    diet varchar(50) null,
    target_calories integer null check (target_calories > 0),
    target_servings integer null check (target_servings > 0),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(user_id)
);

-- recipes table - stores user recipes with ai adjustment capabilities
create table if not exists recipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    title varchar(255) not null,
    ingredients jsonb not null default '[]'::jsonb,
    steps jsonb not null default '[]'::jsonb,
    tags jsonb not null default '{}'::jsonb,
    prep_time_minutes integer null check (prep_time_minutes >= 0),
    cook_time_minutes integer null check (cook_time_minutes >= 0),
    total_time_minutes integer null check (total_time_minutes >= 0),
    calories_per_serving integer null check (calories_per_serving >= 0),
    servings integer not null default 1 check (servings > 0),
    is_ai_adjusted boolean default false,
    original_recipe_id uuid null references recipes(id),
    confidence_score decimal(3,2) null check (confidence_score >= 0 and confidence_score <= 1),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone null
);

-- recipe_ratings table - stores user ratings for recipes
create table if not exists recipe_ratings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    recipe_id uuid not null references recipes(id) on delete cascade,
    rating integer not null check (rating >= 1 and rating <= 5),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(user_id, recipe_id)
);

-- recipe_favorites table - stores user favorite recipes
create table if not exists recipe_favorites (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    recipe_id uuid not null references recipes(id) on delete cascade,
    created_at timestamp with time zone default now(),
    unique(user_id, recipe_id)
);

-- ai_adjustments table - tracks ai recipe adjustments and processing status
create table if not exists ai_adjustments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    original_recipe_id uuid not null references recipes(id) on delete cascade,
    adjusted_recipe_id uuid null references recipes(id) on delete set null,
    parameters jsonb not null default '{}'::jsonb,
    status varchar(50) not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'timeout', 'limit-exceeded', 'invalid-json', 'validation-fail')),
    error_message text null,
    retry_count integer default 0 check (retry_count >= 0),
    max_retries integer default 3 check (max_retries >= 0),
    duration_ms integer null check (duration_ms >= 0),
    model_used varchar(100) null,
    created_at timestamp with time zone default now(),
    completed_at timestamp with time zone null
);

-- presets table - stores ai adjustment presets for different personas
create table if not exists presets (
    id uuid primary key default gen_random_uuid(),
    name varchar(255) not null,
    description text null,
    parameters jsonb not null default '{}'::jsonb,
    access_level varchar(20) not null default 'user' check (access_level in ('global', 'persona', 'user')),
    persona varchar(50) null,
    is_pinned boolean default false,
    usage_count integer default 0,
    created_by uuid null references users(id) on delete set null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- allergen_dictionary table - stores allergen definitions and synonyms
create table if not exists allergen_dictionary (
    id uuid primary key default gen_random_uuid(),
    allergen_name varchar(100) not null unique,
    synonyms jsonb not null default '[]'::jsonb,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- allergen_dictionary_audit table - tracks changes to allergen dictionary
create table if not exists allergen_dictionary_audit (
    id uuid primary key default gen_random_uuid(),
    allergen_id uuid not null references allergen_dictionary(id) on delete cascade,
    action varchar(20) not null check (action in ('created', 'updated', 'deleted')),
    old_values jsonb null,
    new_values jsonb null,
    changed_by uuid not null references users(id) on delete cascade,
    changed_at timestamp with time zone default now()
);

-- analytics_logs table - partitioned table for analytics data
create table if not exists analytics_logs (
    id uuid not null,
    user_id uuid null references users(id) on delete set null,
    recipe_id uuid null references recipes(id) on delete set null,
    action varchar(100) not null,
    status varchar(50) null,
    metadata jsonb not null default '{}'::jsonb,
    ip_address inet null,
    user_agent text null,
    created_at timestamp with time zone default now(),
    primary key (id, created_at)
) partition by range (created_at);

-- user_sessions table - stores encrypted session data
create table if not exists user_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    session_id varchar(255) not null unique,
    session_data bytea not null, -- encrypted session data
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default now(),
    last_accessed_at timestamp with time zone default now()
);

-- login_attempts table - tracks login attempts for security
create table if not exists login_attempts (
    id uuid primary key default gen_random_uuid(),
    ip_address inet not null,
    email varchar(255) null,
    success boolean not null,
    failure_reason varchar(100) null,
    user_agent text null,
    created_at timestamp with time zone default now()
);

-- system_config table - stores system configuration
create table if not exists system_config (
    id uuid primary key default gen_random_uuid(),
    config_key varchar(100) not null unique,
    config_value jsonb not null,
    description text null,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- =============================================================================
-- 2. CREATE PARTITIONS FOR ANALYTICS_LOGS
-- =============================================================================

-- create monthly partitions for analytics_logs (example for 2024-2025)
-- note: additional partitions should be created as needed
create table if not exists analytics_logs_2024_01 partition of analytics_logs
    for values from ('2024-01-01') to ('2024-02-01');
create table if not exists analytics_logs_2024_02 partition of analytics_logs
    for values from ('2024-02-01') to ('2024-03-01');
create table if not exists analytics_logs_2024_03 partition of analytics_logs
    for values from ('2024-03-01') to ('2024-04-01');
create table if not exists analytics_logs_2024_04 partition of analytics_logs
    for values from ('2024-04-01') to ('2024-05-01');
create table if not exists analytics_logs_2024_05 partition of analytics_logs
    for values from ('2024-05-01') to ('2024-06-01');
create table if not exists analytics_logs_2024_06 partition of analytics_logs
    for values from ('2024-06-01') to ('2024-07-01');
create table if not exists analytics_logs_2024_07 partition of analytics_logs
    for values from ('2024-07-01') to ('2024-08-01');
create table if not exists analytics_logs_2024_08 partition of analytics_logs
    for values from ('2024-08-01') to ('2024-09-01');
create table if not exists analytics_logs_2024_09 partition of analytics_logs
    for values from ('2024-09-01') to ('2024-10-01');
create table if not exists analytics_logs_2024_10 partition of analytics_logs
    for values from ('2024-10-01') to ('2024-11-01');
create table if not exists analytics_logs_2024_11 partition of analytics_logs
    for values from ('2024-11-01') to ('2024-12-01');
create table if not exists analytics_logs_2024_12 partition of analytics_logs
    for values from ('2024-12-01') to ('2025-01-01');
create table if not exists analytics_logs_2025_01 partition of analytics_logs
    for values from ('2025-01-01') to ('2025-02-01');
create table if not exists analytics_logs_2025_02 partition of analytics_logs
    for values from ('2025-02-01') to ('2025-03-01');
create table if not exists analytics_logs_2025_03 partition of analytics_logs
    for values from ('2025-03-01') to ('2025-04-01');
create table if not exists analytics_logs_2025_04 partition of analytics_logs
    for values from ('2025-04-01') to ('2025-05-01');
create table if not exists analytics_logs_2025_05 partition of analytics_logs
    for values from ('2025-05-01') to ('2025-06-01');
create table if not exists analytics_logs_2025_06 partition of analytics_logs
    for values from ('2025-06-01') to ('2025-07-01');
create table if not exists analytics_logs_2025_07 partition of analytics_logs
    for values from ('2025-07-01') to ('2025-08-01');
create table if not exists analytics_logs_2025_08 partition of analytics_logs
    for values from ('2025-08-01') to ('2025-09-01');
create table if not exists analytics_logs_2025_09 partition of analytics_logs
    for values from ('2025-09-01') to ('2025-10-01');
create table if not exists analytics_logs_2025_10 partition of analytics_logs
    for values from ('2025-10-01') to ('2025-11-01');
create table if not exists analytics_logs_2025_11 partition of analytics_logs
    for values from ('2025-11-01') to ('2025-12-01');
create table if not exists analytics_logs_2025_12 partition of analytics_logs
    for values from ('2025-12-01') to ('2026-01-01');

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================

-- users table indexes
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_deleted_at on users(deleted_at) where deleted_at is null;
create index if not exists idx_users_active on users(is_active) where is_active = true;

-- user_preferences table indexes
create index if not exists idx_user_preferences_user_id on user_preferences(user_id);
create index if not exists idx_user_preferences_allergens on user_preferences using gin(allergens);

-- recipes table indexes
create index if not exists idx_recipes_user_id on recipes(user_id);
create index if not exists idx_recipes_updated_at on recipes(updated_at desc);
create index if not exists idx_recipes_is_ai_adjusted on recipes(is_ai_adjusted);
create index if not exists idx_recipes_original_recipe_id on recipes(original_recipe_id);
create index if not exists idx_recipes_deleted_at on recipes(deleted_at) where deleted_at is null;
create index if not exists idx_recipes_ingredients on recipes using gin(ingredients);
create index if not exists idx_recipes_tags on recipes using gin(tags);
create index if not exists idx_recipes_calories on recipes(calories_per_serving);
create index if not exists idx_recipes_total_time on recipes(total_time_minutes);

-- composite indexes for common queries
create index if not exists idx_recipes_user_updated on recipes(user_id, updated_at desc);
create index if not exists idx_recipes_user_rating on recipes(user_id, calories_per_serving desc);
create index if not exists idx_recipes_user_time_calories on recipes(user_id, total_time_minutes, calories_per_serving);

-- recipe_ratings table indexes
create index if not exists idx_recipe_ratings_user_id on recipe_ratings(user_id);
create index if not exists idx_recipe_ratings_recipe_id on recipe_ratings(recipe_id);
create index if not exists idx_recipe_ratings_rating on recipe_ratings(rating);
create index if not exists idx_recipe_ratings_recipe_rating on recipe_ratings(recipe_id, rating desc);

-- recipe_favorites table indexes
create index if not exists idx_recipe_favorites_user_id on recipe_favorites(user_id);
create index if not exists idx_recipe_favorites_recipe_id on recipe_favorites(recipe_id);

-- ai_adjustments table indexes
create index if not exists idx_ai_adjustments_user_id on ai_adjustments(user_id);
create index if not exists idx_ai_adjustments_original_recipe_id on ai_adjustments(original_recipe_id);
create index if not exists idx_ai_adjustments_adjusted_recipe_id on ai_adjustments(adjusted_recipe_id);
create index if not exists idx_ai_adjustments_status on ai_adjustments(status);
create index if not exists idx_ai_adjustments_created_at on ai_adjustments(created_at);

-- presets table indexes
create index if not exists idx_presets_access_level on presets(access_level);
create index if not exists idx_presets_persona on presets(persona);
create index if not exists idx_presets_is_pinned on presets(is_pinned);
create index if not exists idx_presets_created_by on presets(created_by);
create index if not exists idx_presets_usage_count on presets(usage_count desc);

-- allergen_dictionary table indexes
create index if not exists idx_allergen_dictionary_name on allergen_dictionary(allergen_name);
create index if not exists idx_allergen_dictionary_is_active on allergen_dictionary(is_active);
create index if not exists idx_allergen_dictionary_synonyms on allergen_dictionary using gin(synonyms);

-- allergen_dictionary_audit table indexes
create index if not exists idx_allergen_audit_allergen_id on allergen_dictionary_audit(allergen_id);
create index if not exists idx_allergen_audit_changed_by on allergen_dictionary_audit(changed_by);
create index if not exists idx_allergen_audit_changed_at on allergen_dictionary_audit(changed_at);

-- analytics_logs table indexes
create index if not exists idx_analytics_logs_user_id on analytics_logs(user_id);
create index if not exists idx_analytics_logs_recipe_id on analytics_logs(recipe_id);
create index if not exists idx_analytics_logs_action on analytics_logs(action);
create index if not exists idx_analytics_logs_status on analytics_logs(status);
create index if not exists idx_analytics_logs_created_at on analytics_logs(created_at);
create index if not exists idx_analytics_logs_metadata on analytics_logs using gin(metadata);

-- user_sessions table indexes
create index if not exists idx_user_sessions_user_id on user_sessions(user_id);
create index if not exists idx_user_sessions_session_id on user_sessions(session_id);
create index if not exists idx_user_sessions_expires_at on user_sessions(expires_at);

-- login_attempts table indexes
create index if not exists idx_login_attempts_ip_address on login_attempts(ip_address);
create index if not exists idx_login_attempts_created_at on login_attempts(created_at);
create index if not exists idx_login_attempts_success on login_attempts(success);

-- system_config table indexes
create index if not exists idx_system_config_key on system_config(config_key);
create index if not exists idx_system_config_active on system_config(is_active);

-- =============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================================================

-- enable rls on all tables for data security
alter table users enable row level security;
alter table user_preferences enable row level security;
alter table recipes enable row level security;
alter table recipe_ratings enable row level security;
alter table recipe_favorites enable row level security;
alter table ai_adjustments enable row level security;
alter table user_sessions enable row level security;

-- note: some tables are intentionally not protected by rls:
-- - presets (may need public access for global presets)
-- - allergen_dictionary (public reference data)
-- - allergen_dictionary_audit (system table)
-- - analytics_logs (system analytics)
-- - login_attempts (security logging)
-- - system_config (system configuration)

-- =============================================================================
-- 5. CREATE RLS POLICIES
-- =============================================================================

-- users table policies - users can only access their own data
create policy "users_select_own_data" on users
    for select to authenticated
    using (auth.uid() = id);

create policy "users_insert_own_data" on users
    for insert to authenticated
    with check (auth.uid() = id);

create policy "users_update_own_data" on users
    for update to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy "users_delete_own_data" on users
    for delete to authenticated
    using (auth.uid() = id);

-- user_preferences table policies - users can only access their own preferences
create policy "user_preferences_select_own_data" on user_preferences
    for select to authenticated
    using (auth.uid() = user_id);

create policy "user_preferences_insert_own_data" on user_preferences
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "user_preferences_update_own_data" on user_preferences
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "user_preferences_delete_own_data" on user_preferences
    for delete to authenticated
    using (auth.uid() = user_id);

-- recipes table policies - users can only access their own recipes
create policy "recipes_select_own_data" on recipes
    for select to authenticated
    using (auth.uid() = user_id);

create policy "recipes_insert_own_data" on recipes
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "recipes_update_own_data" on recipes
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "recipes_delete_own_data" on recipes
    for delete to authenticated
    using (auth.uid() = user_id);

-- recipe_ratings table policies - users can only access their own ratings
create policy "recipe_ratings_select_own_data" on recipe_ratings
    for select to authenticated
    using (auth.uid() = user_id);

create policy "recipe_ratings_insert_own_data" on recipe_ratings
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "recipe_ratings_update_own_data" on recipe_ratings
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "recipe_ratings_delete_own_data" on recipe_ratings
    for delete to authenticated
    using (auth.uid() = user_id);

-- recipe_favorites table policies - users can only access their own favorites
create policy "recipe_favorites_select_own_data" on recipe_favorites
    for select to authenticated
    using (auth.uid() = user_id);

create policy "recipe_favorites_insert_own_data" on recipe_favorites
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "recipe_favorites_update_own_data" on recipe_favorites
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "recipe_favorites_delete_own_data" on recipe_favorites
    for delete to authenticated
    using (auth.uid() = user_id);

-- ai_adjustments table policies - users can only access their own adjustments
create policy "ai_adjustments_select_own_data" on ai_adjustments
    for select to authenticated
    using (auth.uid() = user_id);

create policy "ai_adjustments_insert_own_data" on ai_adjustments
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "ai_adjustments_update_own_data" on ai_adjustments
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "ai_adjustments_delete_own_data" on ai_adjustments
    for delete to authenticated
    using (auth.uid() = user_id);

-- user_sessions table policies - users can only access their own sessions
create policy "user_sessions_select_own_data" on user_sessions
    for select to authenticated
    using (auth.uid() = user_id);

create policy "user_sessions_insert_own_data" on user_sessions
    for insert to authenticated
    with check (auth.uid() = user_id);

create policy "user_sessions_update_own_data" on user_sessions
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "user_sessions_delete_own_data" on user_sessions
    for delete to authenticated
    using (auth.uid() = user_id);

-- =============================================================================
-- 6. CREATE FUNCTIONS AND TRIGGERS
-- =============================================================================

-- function to validate eu allergens (14 allergens required by eu law)
create or replace function validate_eu_allergens(allergens jsonb)
returns boolean as $$
declare
    valid_allergens text[] := array[
        'gluten', 'skorupiaki', 'jaja', 'ryby', 'orzeszki_ziemne',
        'soja', 'mleko', 'orzechy', 'seler', 'gorczyca',
        'sezam', 'dwutlenek_siarki', 'łubin', 'mięczaki'
    ];
    allergen text;
begin
    for allergen in select jsonb_array_elements_text(allergens)
    loop
        if not (allergen = any(valid_allergens)) then
            return false;
        end if;
    end loop;
    return true;
end;
$$ language plpgsql;

-- function to cleanup old data for maintenance
create or replace function cleanup_old_data()
returns void as $$
begin
    -- delete login attempts older than 1 hour
    delete from login_attempts where created_at < now() - interval '1 hour';
    
    -- delete expired sessions
    delete from user_sessions where expires_at < now();
    
    -- soft delete users older than 12 months (soft delete)
    update users set deleted_at = now() 
    where deleted_at is null and created_at < now() - interval '12 months';
end;
$$ language plpgsql;

-- function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- =============================================================================
-- 7. ADD CONSTRAINTS
-- =============================================================================

-- add constraint to validate eu allergens in user_preferences
alter table user_preferences add constraint check_eu_allergens 
check (validate_eu_allergens(allergens));

-- =============================================================================
-- 8. CREATE TRIGGERS
-- =============================================================================

-- create triggers for automatic updated_at updates
create trigger update_users_updated_at 
    before update on users 
    for each row execute function update_updated_at_column();

create trigger update_user_preferences_updated_at 
    before update on user_preferences 
    for each row execute function update_updated_at_column();

create trigger update_recipes_updated_at 
    before update on recipes 
    for each row execute function update_updated_at_column();

create trigger update_recipe_ratings_updated_at 
    before update on recipe_ratings 
    for each row execute function update_updated_at_column();

create trigger update_ai_adjustments_updated_at 
    before update on ai_adjustments 
    for each row execute function update_updated_at_column();

create trigger update_presets_updated_at 
    before update on presets 
    for each row execute function update_updated_at_column();

create trigger update_allergen_dictionary_updated_at 
    before update on allergen_dictionary 
    for each row execute function update_updated_at_column();

create trigger update_system_config_updated_at 
    before update on system_config 
    for each row execute function update_updated_at_column();

-- =============================================================================
-- 9. INSERT INITIAL DATA
-- =============================================================================

-- insert 14 eu allergens into dictionary
insert into allergen_dictionary (allergen_name, synonyms) values
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
('dwutlenek_siarki', '["e220", "siarczyny"]'),
('łubin', '["mąka łubinowa", "nasiona łubinu"]'),
('mięczaki', '["ostrygi", "małże", "ślimaki"]')
on conflict (allergen_name) do nothing;

-- insert basic system configuration
insert into system_config (config_key, config_value, description) values
('ai_daily_limit', '10', 'daily ai adjustment limit per user'),
('ai_timeout_seconds', '20', 'timeout for ai requests in seconds'),
('confidence_threshold', '0.9', 'confidence threshold for recipe structuring'),
('retention_months', '12', 'data retention period in months'),
('rate_limit_attempts', '5', 'number of login attempts before blocking'),
('rate_limit_window_minutes', '5', 'time window for rate limiting in minutes')
on conflict (config_key) do nothing;

-- =============================================================================
-- MIGRATION COMPLETED
-- =============================================================================
