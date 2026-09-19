import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const adminModuleSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(500),
});
export const adminPublishSchema = z.object({ published: z.boolean() });
export const adminSettingSchema = z.object({ key: z.enum(['supported_languages']), value: z.array(z.enum(['en', 'af', 'pt'])).min(1).max(3) });

export async function requireMaricsAdmin(client: SupabaseClient) {
  const { data, error } = await client.rpc('is_marics_admin');
  if (error) throw error;
  if (data !== true) throw new Error('ADMIN_FORBIDDEN');
}

export async function getAdminOverview(client: SupabaseClient) {
  const { data, error } = await client.rpc('get_admin_overview');
  if (error) throw error;
  return data;
}

export async function createAdminModule(client: SupabaseClient, input: z.infer<typeof adminModuleSchema>) {
  const { data, error } = await client.rpc('create_admin_module', { target_slug: input.slug, target_title: { en: input.title }, target_description: { en: input.description } });
  if (error) throw error;
  return data;
}

export async function setAdminModulePublished(client: SupabaseClient, moduleId: string, published: boolean) {
  const { data, error } = await client.rpc('set_admin_module_published', { target_module: moduleId, target_published: published });
  if (error) throw error;
  return data;
}

export async function setAdminSetting(client: SupabaseClient, input: z.infer<typeof adminSettingSchema>) {
  const { data, error } = await client.rpc('set_admin_setting', { target_key: input.key, target_value: input.value });
  if (error) throw error;
  return data;
}