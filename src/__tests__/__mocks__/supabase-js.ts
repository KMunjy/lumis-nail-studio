/**
 * Vitest stub for @supabase/supabase-js.
 *
 * @supabase/supabase-js is not installed in the test environment.
 * This stub satisfies Vite's static import resolution so loyalty.ts,
 * saved-looks.ts, and other modules that dynamically import supabase
 * can be imported in tests without errors.
 *
 * All async methods return empty/null results so logic paths that depend
 * on real Supabase data gracefully return null or empty arrays (as coded).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeQueryBuilder(): any {
  const builder: any = {
    select:  () => builder,
    insert:  () => builder,
    update:  () => builder,
    delete:  () => builder,
    upsert:  () => builder,
    eq:      () => builder,
    order:   () => builder,
    limit:   () => builder,
    single:  async () => ({ data: null, error: null }),
    then:    (resolve: (v: any) => any) => Promise.resolve(resolve({ data: null, error: null })),
  };
  return builder;
}

export function createClient(_url?: string, _key?: string): any {
  return {
    from:  () => makeQueryBuilder(),
    rpc:   async () => ({ data: null, error: null }),
    auth:  {
      signInWithOtp:         async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ error: null }),
      getSession:            async () => ({ data: { session: null }, error: null }),
    },
    storage: {
      from: () => ({
        upload:       async () => ({ error: null }),
        remove:       async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };
}

export const createRouteHandlerClient = createClient;
export const createServerComponentClient = createClient;
