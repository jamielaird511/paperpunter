import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { url, anonKey };
}

export function createSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey);
}

let browserClient: SupabaseClient | null = null;

/** Singleton browser client — keeps auth session across refreshes. */
export function getSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseClient() must be used in client components");
  }

  if (!browserClient) {
    browserClient = createSupabaseClient();
  }

  return browserClient;
}
