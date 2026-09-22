import { describe, expect, it } from 'vitest';
import { getOrganizationDashboard, listOrganizations, requireOrganizationAdmin } from './organizations.js';

function membershipQuery(result: { is_admin: boolean } | null) {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: result, error: null });
    },
  };
}

describe('organization access isolation', () => {
  it('blocks dashboard access when the caller is not an admin of the target organization', async () => {
    const client = {
      from(table: string) {
        if (table === 'organization_memberships') return membershipQuery({ is_admin: false });
        throw new Error(`unexpected table ${table}`);
      },
      rpc() {
        throw new Error('RPC should not run when admin check fails');
      },
    };

    await expect(getOrganizationDashboard(client as never, 'org-star')).rejects.toThrow('FORBIDDEN');
  });

  it('requires admin membership before invoking organization dashboard RPC', async () => {
    const calls: string[] = [];
    const client = {
      from(table: string) {
        if (table === 'organization_memberships') return membershipQuery({ is_admin: true });
        throw new Error(`unexpected table ${table}`);
      },
      async rpc(name: string) {
        calls.push(name);
        return { data: { organization: { id: 'org-star', name: 'Star' } }, error: null };
      },
    };

    await getOrganizationDashboard(client as never, 'org-star');
    expect(calls).toEqual(['get_organization_dashboard']);
  });

  it('loads only memberships visible to the authenticated user', async () => {
    const calls: string[] = [];
    const client = {
      from(table: string) {
        if (table !== 'organization_memberships') throw new Error(`unexpected table ${table}`);
        return {
          select(selection: string) {
            calls.push(selection);
            return this;
          },
          order() {
            return Promise.resolve({
              data: [{ organization_id: 'org-a', is_admin: true, organizations: { id: 'org-a', name: 'Star' } }],
              error: null,
            });
          },
        };
      },
    };

    const organizations = await listOrganizations(client as never);
    expect(organizations).toEqual([{ id: 'org-a', isAdmin: true, name: 'Star' }]);
    expect(calls[0]).toContain('organization_id');
  });

  it('rejects non-admin organization management actions at the service layer', async () => {
    const client = {
      from() {
        return membershipQuery(null);
      },
    };

    await expect(requireOrganizationAdmin(client as never, 'org-other')).rejects.toThrow('FORBIDDEN');
  });
});
