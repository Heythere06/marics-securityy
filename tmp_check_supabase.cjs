const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx > 0) {
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
}
Object.assign(process.env, env);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

(async () => {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [usersRes, profilesRes, orgsRes, membershipsRes, invitesRes] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('profiles').select('id, full_name, role, account_type, preferred_language, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name, created_by, created_at'),
    supabase.from('organization_memberships').select('organization_id, user_id, is_admin, created_at'),
    supabase.from('organization_invitations').select('id, organization_id, email, accepted_at, expires_at, created_at')
  ]);

  if (usersRes.error) throw usersRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (orgsRes.error) throw orgsRes.error;
  if (membershipsRes.error) throw membershipsRes.error;
  if (invitesRes.error) throw invitesRes.error;

  console.log(JSON.stringify({
    authUsers: usersRes.data.users.slice(0, 10).map(u => ({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at, created_at: u.created_at })),
    profiles: profilesRes.data.slice(0, 20).map(p => ({ id: p.id, full_name: p.full_name, role: p.role, account_type: p.account_type, preferred_language: p.preferred_language })),
    orgs: orgsRes.data.slice(0, 20).map(o => ({ id: o.id, name: o.name, created_by: o.created_by })),
    memberships: membershipsRes.data.slice(0, 20).map(m => ({ organization_id: m.organization_id, user_id: m.user_id, is_admin: m.is_admin })),
    invitations: invitesRes.data.slice(0, 20).map(i => ({ id: i.id, organization_id: i.organization_id, email: i.email, accepted_at: i.accepted_at, expires_at: i.expires_at }))
  }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
