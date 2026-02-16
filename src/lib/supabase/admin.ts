import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. Use ONLY for authenticated write routes
// where the CLI sends a REEF_TOKEN (not a Supabase session).
// NEVER use for public read routes.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
