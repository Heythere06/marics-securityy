import type { SupabaseClient } from '@supabase/supabase-js';

export async function recordAuditLog(
  client: SupabaseClient,
  input: { action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> },
) {
  const { error } = await client.rpc('admin_record_audit', {
    target_action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    target_metadata: input.metadata ?? {},
  });
  if (error) throw error;
}
