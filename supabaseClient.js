/* ============================================================================
   Supabase client — single shared connection for the whole app.
   The anon/publishable key is PUBLIC by design; your data is protected by
   Row-Level Security policies on the server (see SUPABASE_SETUP.md).
   ========================================================================== */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://vrwllkxqfwxaadipbqed.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_bnyXHSp3aUK-pGPvNEQDqQ_bpSz7uVi';

  if (!global.supabase || !global.supabase.createClient) {
    console.error('[Phoenix] Supabase library failed to load — check the CDN <script> tag.');
    global.sb = null;
    return;
  }

  global.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'phoenix-auth'
    }
  });
})(typeof window !== 'undefined' ? window : this);
