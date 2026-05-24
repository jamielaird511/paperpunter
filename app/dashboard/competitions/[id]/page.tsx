"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Competition = {
  id: string;
  name: string;
  sport_code: string;
  season: string | null;
  season_id: string | null;
  status: string;
  visibility: string;
  invite_code: string;
  member_limit: number;
};

type ProfileDetails = {
  id: string;
  display_name: string | null;
};

type CompetitionMember = {
  id: string;
  role: string;
  displayName: string;
};

type SourceRound = {
  id: string;
  name: string;
  round_number: number | null;
  lock_time: string | null;
};

type SourceFixture = {
  id: string;
  source_round_id: string;
  home_team: string;
  away_team: string;
  starts_at: string | null;
};

function formatSportCode(code: string): string {
  return code
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "TBC";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function normalizeProfile(
  profiles: ProfileDetails | ProfileDetails[] | null | undefined,
): ProfileDetails | null {
  if (!profiles) {
    return null;
  }

  if (Array.isArray(profiles)) {
    return profiles[0] ?? null;
  }

  return profiles;
}

export default function CompetitionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [members, setMembers] = useState<CompetitionMember[]>([]);
  const [sourceRounds, setSourceRounds] = useState<SourceRound[]>([]);
  const [sourceFixtures, setSourceFixtures] = useState<SourceFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixtureSetError, setFixtureSetError] = useState<string | null>(null);

  const loadFixtureSet = useCallback(async (seasonId: string) => {
    const supabase = getSupabaseClient();

    const { data: roundsData, error: roundsFetchError } = await supabase
      .from("source_rounds")
      .select("id, name, round_number, lock_time")
      .eq("season_id", seasonId)
      .order("round_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (roundsFetchError) {
      setFixtureSetError(roundsFetchError.message);
      return;
    }

    const roundIds = (roundsData ?? []).map((round) => round.id);

    if (roundIds.length === 0) {
      setFixtureSetError(null);
      setSourceRounds([]);
      setSourceFixtures([]);
      return;
    }

    const { data: fixturesData, error: fixturesFetchError } = await supabase
      .from("source_fixtures")
      .select("id, source_round_id, home_team, away_team, starts_at")
      .in("source_round_id", roundIds)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (fixturesFetchError) {
      setFixtureSetError(fixturesFetchError.message);
      return;
    }

    setFixtureSetError(null);
    setSourceRounds(roundsData ?? []);
    setSourceFixtures(fixturesData ?? []);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function loadCompetition() {
      setLoading(true);
      setError(null);
      setFixtureSetError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("competition_members")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError || !membership) {
        router.replace("/dashboard");
        return;
      }

      const { data: competitionData, error: competitionError } = await supabase
        .from("competitions")
        .select(
          "id, name, sport_code, season, season_id, status, visibility, invite_code, member_limit",
        )
        .eq("id", competitionId)
        .single();

      if (competitionError || !competitionData) {
        setError(competitionError?.message ?? "Competition not found.");
        setLoading(false);
        return;
      }

      const { data: membersData, error: membersError } = await supabase
        .from("competition_members")
        .select(
          `
          id,
          role,
          profiles (
            id,
            display_name
          )
        `,
        )
        .eq("competition_id", competitionId)
        .eq("status", "active");

      if (membersError) {
        setError(membersError.message);
        setLoading(false);
        return;
      }

      const memberList = (membersData ?? [])
        .map((row) => {
          const profile = normalizeProfile(
            row.profiles as ProfileDetails | ProfileDetails[] | null,
          );

          return {
            id: row.id,
            role: row.role,
            displayName: profile?.display_name ?? "Unknown player",
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      setCompetition(competitionData);
      setMembers(memberList);

      if (competitionData.season_id) {
        await loadFixtureSet(competitionData.season_id);
      } else {
        setSourceRounds([]);
        setSourceFixtures([]);
      }

      setLoading(false);
    }

    loadCompetition();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, competitionId, loadFixtureSet]);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 font-sans">
        <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          <p className="text-slate-600">Loading…</p>
        </main>
      </div>
    );
  }

  if (error || !competition) {
    return (
      <div className="min-h-full bg-slate-50 font-sans">
        <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            ← Dashboard
          </Link>
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? "Competition not found."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-blue-700">PaperPunter</span>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Back to dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          {competition.name}
        </h1>
        <p className="mt-2 text-slate-600">
          {formatSportCode(competition.sport_code)}
          {competition.season ? ` · ${competition.season}` : null}
        </p>

        <section className="mt-8 rounded-xl border border-blue-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Details</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium capitalize text-slate-900">
                {competition.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Visibility</dt>
              <dd className="font-medium capitalize text-slate-900">
                {competition.visibility}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Invite code</dt>
              <dd className="font-mono font-medium text-blue-700">
                {competition.invite_code}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Member limit</dt>
              <dd className="font-medium text-slate-900">
                {competition.member_limit}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Members ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
              No active members yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3"
                >
                  <span className="font-medium text-slate-900">
                    {member.displayName}
                  </span>
                  <span className="text-sm capitalize text-slate-500">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Fixture set</h2>
          <p className="mt-1 text-sm text-slate-600">
            Rounds and fixtures are managed by PaperPunter, not by competition
            owners.
          </p>

          {fixtureSetError ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {fixtureSetError}
            </p>
          ) : null}

          {!competition.season_id ? (
            <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
              This competition is not linked to a fixture set yet.
            </p>
          ) : sourceRounds.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
              No rounds in this fixture set yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {sourceRounds.map((round) => {
                const roundFixtures = sourceFixtures.filter(
                  (fixture) => fixture.source_round_id === round.id,
                );

                return (
                  <div
                    key={round.id}
                    className="rounded-xl border border-blue-100 bg-white p-5"
                  >
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {round.name}
                      </span>
                      {round.lock_time ? (
                        <span className="text-xs text-slate-500">
                          Lockout: {formatDateTime(round.lock_time)}
                        </span>
                      ) : null}
                    </p>

                    {roundFixtures.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-600">
                        No fixtures in this round yet.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {roundFixtures.map((fixture) => (
                          <li
                            key={fixture.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-blue-50 bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-900">
                              {fixture.home_team} vs {fixture.away_team}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              {formatDateTime(fixture.starts_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
          <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
            Leaderboard coming soon. Scores land here after results are entered.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Picks</h2>
          <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
            Picks coming soon. Tip fixtures from here once rounds are live.
          </p>
        </section>
      </main>
    </div>
  );
}
