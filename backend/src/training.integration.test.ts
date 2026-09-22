import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.MARICS_TEST_SUPABASE_URL;
const anonKey = process.env.MARICS_TEST_SUPABASE_ANON_KEY;
const userAEmail = process.env.MARICS_TEST_USER_A_EMAIL;
const userAPassword = process.env.MARICS_TEST_USER_A_PASSWORD;
const userBEmail = process.env.MARICS_TEST_USER_B_EMAIL;
const userBPassword = process.env.MARICS_TEST_USER_B_PASSWORD;
const configured = Boolean(url && anonKey && userAEmail && userAPassword && userBEmail && userBPassword);

describe.skipIf(!configured)('Supabase training isolation', () => {
  let client: ReturnType<typeof createClient>;
  let userAToken = '';
  let userBToken = '';

  beforeAll(async () => {
    client = createClient(url!, anonKey!);
    const [userA, userB] = await Promise.all([
      client.auth.signInWithPassword({ email: userAEmail!, password: userAPassword! }),
      client.auth.signInWithPassword({ email: userBEmail!, password: userBPassword! }),
    ]);
    if (userA.error) throw userA.error;
    if (userB.error) throw userB.error;
    userAToken = userA.data.session.access_token;
    userBToken = userB.data.session.access_token;
  });

  it('does not expose user A progress to user B', async () => {
    const [summaryA, summaryB] = await Promise.all([
      fetch(`${process.env.MARICS_TEST_API_URL ?? 'http://localhost:4000'}/api/users/me/training-progress`, { headers: { Authorization: `Bearer ${userAToken}` } }),
      fetch(`${process.env.MARICS_TEST_API_URL ?? 'http://localhost:4000'}/api/users/me/training-progress`, { headers: { Authorization: `Bearer ${userBToken}` } }),
    ]);
    expect(summaryA.status).toBe(200);
    expect(summaryB.status).toBe(200);
    const [dataA, dataB] = await Promise.all([summaryA.json(), summaryB.json()]);
    expect(dataA.modules).toEqual(expect.any(Array));
    expect(dataB.modules).toEqual(expect.any(Array));
    expect(JSON.stringify(dataA)).not.toContain(userAToken);
    expect(JSON.stringify(dataB)).not.toContain(userBToken);
  });
});

if (!configured) {
  console.info('Supabase integration test skipped. Configure MARICS_TEST_SUPABASE_URL, MARICS_TEST_SUPABASE_ANON_KEY, two test users, and MARICS_TEST_API_URL.');
}