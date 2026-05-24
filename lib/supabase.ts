import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PickWinner = "home" | "away" | "draw";

export type MemberPickRow = {
  source_fixture_id: string | null;
  selected_winner: PickWinner;
  updated_at?: string;
};

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

export function isFixtureLocked(startsAt: string | null): boolean {
  if (!startsAt) {
    return false;
  }

  return new Date(startsAt).getTime() <= Date.now();
}

export async function loadMemberPicks(
  supabase: SupabaseClient,
  competitionId: string,
  competitionMemberId: string,
) {
  console.log("[loadMemberPicks] input competition_id:", competitionId);
  console.log(
    "[loadMemberPicks] input competition_member_id:",
    competitionMemberId,
  );

  const result = await supabase
    .from("picks")
    .select("source_fixture_id, selected_winner, updated_at")
    .eq("competition_id", competitionId)
    .eq("competition_member_id", competitionMemberId)
    .not("source_fixture_id", "is", null)
    .order("updated_at", { ascending: false });

  console.log("[loadMemberPicks] returned rows:", result.data);
  if (result.error) {
    console.log("[loadMemberPicks] error:", result.error);
  }

  return result;
}

export async function saveMemberPick(
  supabase: SupabaseClient,
  {
    competitionId,
    sourceFixtureId,
    competitionMemberId,
    selectedWinner,
  }: {
    competitionId: string;
    sourceFixtureId: string;
    competitionMemberId: string;
    selectedWinner: PickWinner;
  },
) {
  return supabase.rpc("save_pick", {
    p_competition_id: competitionId,
    p_competition_member_id: competitionMemberId,
    p_source_fixture_id: sourceFixtureId,
    p_selected_winner: selectedWinner,
  });
}
