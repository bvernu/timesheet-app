// Supabase Edge Function: create-employee
//
// Lets a SUPERVISOR create a new employee login. The new account is always placed in the
// supervisor's own company - the browser cannot choose the company.
//
// Deploy (dashboard): Edge Functions -> Deploy a new function -> "Via Editor", name it exactly
// `create-employee`, paste this file, Deploy. Leave "Verify JWT" ON.
// The project URL and API keys are provided to the function automatically (nothing to configure).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Supabase provides the project keys to functions automatically. Older projects expose them as plain
// strings; newer ones as a JSON dictionary with a "default" key. Accept either.
const readKey = (legacyName: string, newName: string): string | undefined => {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get(newName) ?? '{}')['default'];
  } catch {
    return undefined;
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = readKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
  const serviceKey = readKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server is not configured' }, 500);

  // 1. Who is calling? (verified from their login token)
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Not signed in' }, 401);

  // 2. Are they a supervisor, and which company are they in? (read with full access, not from the request)
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller, error: callerError } = await admin
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', userData.user.id)
    .single();
  if (callerError || !caller) return json({ error: 'Profile not found' }, 403);
  if (caller.role !== 'supervisor') return json({ error: 'Only supervisors can create employees' }, 403);

  // 3. Validate the request
  let body: { email?: unknown; full_name?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address' }, 400);
  if (!fullName || fullName.length > 200) return json({ error: 'Enter the employee\'s full name' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  // 4. Create the login. tenant_id comes from the SUPERVISOR's profile, never from the request.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { tenant_id: caller.tenant_id },
  });
  if (error) return json({ error: error.message }, 400);

  return json({ id: data.user.id, email });
});
