import { createServerClient } from "@supabase/ssr";

const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  import.meta.env?.VITE_SUPABASE_URL ||
  "https://csmdlwjmukxeejevyhnw.supabase.co";

const supabaseKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_kyYl2Bfcw0U2ZFsr-7hIsw_45DYmbHE";

export const createClient = (request: any) => {
  let supabaseResponse = {
    headers: new Map(),
    cookies: {
      set: (_name: string, _value: string, _options?: any) => {},
    },
  };

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request?.cookies?.getAll ? request.cookies.getAll() : [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request?.cookies?.set?.(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  return { supabase, supabaseResponse };
};
