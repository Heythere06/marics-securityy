import { describe, expect, it } from 'vitest';
import { removeOrganizationMember } from './organizations.js';

describe('removeOrganizationMember', () => {
  it('blocks removal when the caller is not an org admin', async () => {
    const client = {
      auth: {
        getUser() {
          return Promise.resolve({ data: { user: { id: 'admin-a' } }, error: null });
        },
      },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({ data: { is_admin: false }, error: null });
          },
        };
      },
      rpc() {
        throw new Error('RPC should not run when admin check fails');
      },
    };

    await expect(removeOrganizationMember(client as never, 'org-a', 'user-b')).rejects.toThrow('FORBIDDEN');
  });

  it('maps last-admin RPC failures to LAST_ADMIN', async () => {
    const client = {
      auth: {
        getUser() {
          return Promise.resolve({ data: { user: { id: 'admin-a' } }, error: null });
        },
      },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({ data: { is_admin: true }, error: null });
          },
        };
      },
      rpc() {
        return Promise.resolve({ data: null, error: { message: 'LAST_ADMIN', details: '', hint: '', code: 'P0001' } });
      },
    };

    await expect(removeOrganizationMember(client as never, 'org-a', 'admin-b')).rejects.toThrow('LAST_ADMIN');
  });

  it('returns removed payload from the remove RPC', async () => {
    const client = {
      auth: {
        getUser() {
          return Promise.resolve({ data: { user: { id: 'admin-a' } }, error: null });
        },
      },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({ data: { is_admin: true }, error: null });
          },
        };
      },
      rpc(_name: string, args: { target_org: string; target_user: string }) {
        expect(args).toEqual({ target_org: 'org-a', target_user: 'user-b' });
        return Promise.resolve({
          data: { organizationId: 'org-a', userId: 'user-b', removed: true },
          error: null,
        });
      },
    };

    await expect(removeOrganizationMember(client as never, 'org-a', 'user-b')).resolves.toEqual({
      organizationId: 'org-a',
      userId: 'user-b',
      removed: true,
    });
  });
});
