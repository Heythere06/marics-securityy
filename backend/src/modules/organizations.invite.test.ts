import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    createServiceClient: createServiceClientMock,
  };
});

import { acceptInvitation, createInvitation } from './organizations.js';

describe('invitation integrity', () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it('does not fall back to service-role create on unrelated RPC errors', async () => {
    const client = {
      auth: {
        getUser() {
          return Promise.resolve({ data: { user: { id: 'admin-a' } }, error: null });
        },
      },
      from(table: string) {
        if (table === 'organization_memberships') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle() { return Promise.resolve({ data: { is_admin: true }, error: null }); },
          };
        }
        if (table === 'organizations') {
          return {
            select() { return this; },
            eq() { return this; },
            single() { return Promise.resolve({ data: { name: 'Star' }, error: null }); },
          };
        }
        if (table === 'profiles') {
          return {
            select() { return this; },
            eq() { return this; },
            single() { return Promise.resolve({ data: { full_name: 'Admin' }, error: null }); },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc() {
        return Promise.resolve({ data: null, error: { message: 'FORBIDDEN', details: '', hint: '', code: 'P0001' } });
      },
    };

    await expect(createInvitation(client as never, 'org-a', 'learner@example.com')).rejects.toMatchObject({ message: 'FORBIDDEN' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('claims the invitation before membership on pgcrypto accept fallback', async () => {
    const calls: string[] = [];
    createServiceClientMock.mockReturnValue({
      from(table: string) {
        if (table === 'organization_invitations') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle() {
              calls.push('select-invitation');
              return Promise.resolve({
                data: {
                  id: 'inv-1',
                  email: 'learner@example.com',
                  expires_at: '2030-01-01T00:00:00.000Z',
                  accepted_at: null,
                  organization_id: 'org-a',
                },
                error: null,
              });
            },
            update() {
              calls.push('claim-invitation');
              return {
                eq() { return this; },
                is() { return this; },
                select() { return this; },
                maybeSingle() {
                  return Promise.resolve({ data: { id: 'inv-1' }, error: null });
                },
              };
            },
          };
        }
        if (table === 'organization_memberships') {
          return {
            upsert() {
              calls.push('upsert-membership');
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc(name: string) {
        calls.push(`rpc:${name}`);
        return Promise.resolve({ error: null });
      },
    });

    const client = {
      auth: {
        getUser() {
          return Promise.resolve({ data: { user: { id: 'user-b', email: 'learner@example.com' } }, error: null });
        },
      },
      rpc() {
        return Promise.resolve({ data: null, error: { message: 'function digest(text, unknown) does not exist', code: '42883' } });
      },
    };

    await expect(acceptInvitation(client as never, 'a'.repeat(64))).resolves.toEqual({ organizationId: 'org-a' });
    expect(calls.indexOf('claim-invitation')).toBeLessThan(calls.indexOf('upsert-membership'));
  });
});
