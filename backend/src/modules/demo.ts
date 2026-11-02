import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../lib/supabase.js';

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  organizationName: z.string().trim().max(180).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().min(10).max(2000),
  language: z.enum(['en', 'af', 'pt']).optional(),
});

export async function createDemoRequest(input: z.infer<typeof demoRequestSchema>) {
  const service = createServiceClient();
  const { data, error } = await service.from('demo_requests').insert({
    name: input.name,
    email: input.email.toLowerCase(),
    organization_name: input.organizationName || null,
    phone: input.phone || null,
    message: input.message,
    language: input.language ?? 'en',
  }).select('id, created_at').single();
  if (error) throw error;
  return data;
}

export async function listDemoRequests(client: SupabaseClient) {
  const { data, error } = await client.from('demo_requests').select('id, name, email, organization_name, phone, message, language, status, created_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    organizationName: row.organization_name,
    phone: row.phone,
    message: row.message,
    language: row.language,
    status: row.status,
    createdAt: row.created_at,
  }));
}
