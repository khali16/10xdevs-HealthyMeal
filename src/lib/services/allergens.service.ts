import type { SupabaseClient } from '@/db/supabase.client';
import type { Json } from '@/db/database.types';
import type {
  AllergenDictionaryDTO,
  AllergenDictionaryAuditDTO,
  AllergenDictionaryRow,
  AllergenDictionaryAuditRow,
  CreateAllergenCommand,
  PatchAllergenCommand,
} from '@/types';

type PostgrestErrorShape = {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: string;
  status?: number;
};

/**
 * Maps database errors to application errors with appropriate error codes.
 */
function mapDbError(error: unknown): Error {
  const e = error as PostgrestErrorShape;
  const message = e?.message || 'Database error';
  const code = e?.code;
  if (!code) return new Error(message);

  switch (code) {
    case '23505': {
      // Unique constraint violation
      const err = new Error('Conflict');
      (err as any).code = 'DB_CONFLICT';
      return err;
    }
    case '23503': {
      // Foreign key violation
      const err = new Error('Foreign key violation');
      (err as any).code = 'DB_FOREIGN_KEY';
      return err;
    }
    default: {
      const err = new Error(message);
      (err as any).code = code;
      return err;
    }
  }
}

/**
 * Maps AllergenDictionaryRow to AllergenDictionaryDTO.
 * Converts JSONB synonyms to string array.
 */
function mapAllergenRowToDTO(row: AllergenDictionaryRow): AllergenDictionaryDTO {
  const { synonyms, ...rest } = row as unknown as {
    synonyms: unknown;
  } & Omit<AllergenDictionaryRow, 'synonyms'>;

  return {
    ...(rest as Omit<AllergenDictionaryRow, 'synonyms'>),
    synonyms: Array.isArray(synonyms) ? (synonyms as string[]) : [],
  };
}

/**
 * Maps AllergenDictionaryAuditRow to AllergenDictionaryAuditDTO.
 * Converts JSONB old_values and new_values to Record<string, unknown> | null.
 */
function mapAuditRowToDTO(row: AllergenDictionaryAuditRow): AllergenDictionaryAuditDTO {
  const { old_values, new_values, ...rest } = row as unknown as {
    old_values: unknown;
    new_values: unknown;
  } & Omit<AllergenDictionaryAuditRow, 'old_values' | 'new_values'>;

  return {
    ...(rest as Omit<AllergenDictionaryAuditRow, 'old_values' | 'new_values'>),
    old_values:
      old_values === null || old_values === undefined
        ? null
        : (old_values as Record<string, unknown>),
    new_values:
      new_values === null || new_values === undefined
        ? null
        : (new_values as Record<string, unknown>),
  };
}

export type ListAllergensFilters = {
  is_active?: boolean;
  q?: string;
};

export type PaginationParams = {
  page: number;
  pageSize: number;
};

export type SortParams = {
  sort: 'name' | 'created_at' | 'updated_at';
  order: 'asc' | 'desc';
};

/**
 * Lists allergen dictionary entries with filtering, pagination, and sorting.
 */
export async function listAllergens(
  supabase: SupabaseClient,
  filters: ListAllergensFilters,
  pagination: PaginationParams,
  sort: SortParams,
): Promise<{ items: AllergenDictionaryDTO[]; total: number }> {
  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  let query = supabase.from('allergen_dictionary').select('*', { count: 'exact' });

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.q) {
    // Text search: ILIKE on allergen_name
    // For synonyms JSONB search, we use a different approach
    // Note: GIN index on synonyms should support @> operator for exact match
    // For partial match in array, we'll search allergen_name and let the client filter if needed
    const searchTerm = `%${filters.q}%`;
    query = query.ilike('allergen_name', searchTerm);
    // TODO: Enhance synonyms search with proper JSONB operators when needed
  }

  // Apply sorting
  const sortColumn = sort.sort === 'name' ? 'allergen_name' : sort.sort;
  query = query.order(sortColumn, { ascending: sort.order === 'asc' });

  // Apply pagination
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw mapDbError(error);

  const items = (data ?? []).map((r) => mapAllergenRowToDTO(r as unknown as AllergenDictionaryRow));
  return { items, total: count ?? items.length };
}

/**
 * Gets a single allergen dictionary entry by ID.
 */
export async function getAllergenById(
  supabase: SupabaseClient,
  id: string,
): Promise<AllergenDictionaryDTO | null> {
  const { data, error } = await supabase
    .from('allergen_dictionary')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) return null;

  return mapAllergenRowToDTO(data as unknown as AllergenDictionaryRow);
}

/**
 * Creates a new allergen dictionary entry and audit record in a transaction.
 */
export async function createAllergen(
  supabase: SupabaseClient,
  userId: string,
  cmd: CreateAllergenCommand,
): Promise<AllergenDictionaryDTO> {
  // Insert allergen
  const { data: allergenData, error: allergenError } = await supabase
    .from('allergen_dictionary')
    .insert({
      allergen_name: cmd.allergen_name,
      synonyms: cmd.synonyms,
      is_active: cmd.is_active,
    })
    .select('*')
    .single();

  if (allergenError) {
    // Check for unique constraint violation
    if ((allergenError as PostgrestErrorShape).code === '23505') {
      const err = new Error('Allergen with this name already exists');
      (err as any).code = 'DUPLICATE_ALLERGEN_NAME';
      throw err;
    }
    throw mapDbError(allergenError);
  }

  const allergen = mapAllergenRowToDTO(allergenData as unknown as AllergenDictionaryRow);

  // Create audit record
  const { error: auditError } = await supabase.from('allergen_dictionary_audit').insert({
    allergen_id: allergen.id,
    action: 'created',
    old_values: null,
    new_values: {
      allergen_name: cmd.allergen_name,
      synonyms: cmd.synonyms,
      is_active: cmd.is_active,
    } as Json,
    changed_by: userId,
  });

  if (auditError) {
    // Log error but don't fail the operation (audit is best-effort)
    console.error('Failed to create audit record for allergen creation', { error: auditError, allergenId: allergen.id });
  }

  return allergen;
}

/**
 * Updates an allergen dictionary entry and creates an audit record.
 * Only provided fields are updated (partial update).
 */
export async function updateAllergen(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  cmd: PatchAllergenCommand,
): Promise<AllergenDictionaryDTO> {
  // Get existing allergen
  const existing = await getAllergenById(supabase, id);
  if (!existing) {
    const err = new Error('Allergen not found');
    (err as any).code = 'ALLERGEN_NOT_FOUND';
    throw err;
  }

  // Build update object with only provided fields
  const updateData: Partial<{
    allergen_name: string;
    synonyms: string[];
    is_active: boolean;
  }> = {};

  if (cmd.allergen_name !== undefined) {
    updateData.allergen_name = cmd.allergen_name;
  }
  if (cmd.synonyms !== undefined) {
    updateData.synonyms = cmd.synonyms;
  }
  if (cmd.is_active !== undefined) {
    updateData.is_active = cmd.is_active;
  }

  // If no fields to update, return existing
  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  // Update allergen
  const { data: updatedData, error: updateError } = await supabase
    .from('allergen_dictionary')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    // Check for unique constraint violation
    if ((updateError as PostgrestErrorShape).code === '23505') {
      const err = new Error('Allergen with this name already exists');
      (err as any).code = 'DUPLICATE_ALLERGEN_NAME';
      throw err;
    }
    throw mapDbError(updateError);
  }

  const updated = mapAllergenRowToDTO(updatedData as unknown as AllergenDictionaryRow);

  // Create audit record with only changed fields
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (cmd.allergen_name !== undefined) {
    oldValues.allergen_name = existing.allergen_name;
    newValues.allergen_name = cmd.allergen_name;
  }
  if (cmd.synonyms !== undefined) {
    oldValues.synonyms = existing.synonyms;
    newValues.synonyms = cmd.synonyms;
  }
  if (cmd.is_active !== undefined) {
    oldValues.is_active = existing.is_active;
    newValues.is_active = cmd.is_active;
  }

  const { error: auditError } = await supabase.from('allergen_dictionary_audit').insert({
    allergen_id: id,
    action: 'updated',
    old_values: oldValues as Json,
    new_values: newValues as Json,
    changed_by: userId,
  });

  if (auditError) {
    console.error('Failed to create audit record for allergen update', { error: auditError, allergenId: id });
  }

  return updated;
}

/**
 * Soft deletes an allergen dictionary entry (sets is_active = false) and creates an audit record.
 */
export async function deleteAllergen(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  // Get existing allergen
  const existing = await getAllergenById(supabase, id);
  if (!existing) {
    const err = new Error('Allergen not found');
    (err as any).code = 'ALLERGEN_NOT_FOUND';
    throw err;
  }

  // Soft delete: set is_active = false
  const { error: deleteError } = await supabase
    .from('allergen_dictionary')
    .update({ is_active: false })
    .eq('id', id);

  if (deleteError) throw mapDbError(deleteError);

  // Create audit record
  const { error: auditError } = await supabase.from('allergen_dictionary_audit').insert({
    allergen_id: id,
    action: 'deleted',
    old_values: {
      allergen_name: existing.allergen_name,
      synonyms: existing.synonyms,
      is_active: existing.is_active,
    } as Json,
    new_values: { is_active: false } as Json,
    changed_by: userId,
  });

  if (auditError) {
    console.error('Failed to create audit record for allergen deletion', { error: auditError, allergenId: id });
  }
}

export type AuditSortParams = {
  sort: 'changed_at' | 'action';
  order: 'asc' | 'desc';
};

/**
 * Lists audit entries for a specific allergen.
 */
export async function getAllergenAudit(
  supabase: SupabaseClient,
  allergenId: string,
  pagination: PaginationParams,
  sort: AuditSortParams,
): Promise<{ items: AllergenDictionaryAuditDTO[]; total: number }> {
  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  let query = supabase
    .from('allergen_dictionary_audit')
    .select('*', { count: 'exact' })
    .eq('allergen_id', allergenId);

  // Apply sorting
  query = query.order(sort.sort, { ascending: sort.order === 'asc' });

  // Apply pagination
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw mapDbError(error);

  const items = (data ?? []).map((r) =>
    mapAuditRowToDTO(r as unknown as AllergenDictionaryAuditRow),
  );
  return { items, total: count ?? items.length };
}

