"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Competition = {
  id: string;
  name: string;
  sport_code: string;
  season: string | null;
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

type Round = {
  id: string;
  name: string;
  round_number: number | null;
  lock_time: string | null;
};

type Fixture = {
  id: string;
  round_id: string;
  home_team: string;
  away_team: string;
  starts_at: string | null;
};

type FixtureForm = {
  home: string;
  away: string;
  kickoff: string;
};

const inputClassName =
  "mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

const emptyFixtureForm: FixtureForm = { home: "", away: "", kickoff: "" };

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
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roundsError, setRoundsError] = useState<string | null>(null);

  const [roundName, setRoundName] = useState("");
  const [roundLockTime, setRoundLockTime] = useState("");
  const [roundSubmitting, setRoundSubmitting] = useState(false);

  const [fixtureForms, setFixtureForms] = useState<Record<string, FixtureForm>>(
    {},
  );
  const [fixtureSubmitting, setFixtureSubmitting] = useState<string | null>(
    null,
  );

  const canManage =
    currentUserRole === "owner" || currentUserRole === "admin";

  const loadRoundsAndFixtures = useCallback(async () => {
    const supabase = getSupabaseClient();

    const { data: roundsData, error: roundsFetchError } = await supabase
      .from("rounds")
      .select("id, name, round_number, lock_time")
      .eq("competition_id", competitionId)
      .order("round_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (roundsFetchError) {
      setRoundsError(roundsFetchError.message);
      return;
    }

    const { data: fixturesData, error: fixturesFetchError } = await supabase
      .from("fixtures")
      .select("id, round_id, home_team, away_team, starts_at")
      .eq("competition_id", competitionId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (fixturesFetchError) {
      setRoundsError(fixturesFetchError.message);
      return;
    }

    setRoundsError(null);
    setRounds(roundsData ?? []);
    setFixtures(fixturesData ?? []);
  }, [competitionId]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function loadCompetition() {
      setLoading(true);
      setError(null);

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
        .select("id, role")
        .eq("competition_id", competitionId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError || !membership) {
        router.replace("/dashboard");
        return;
      }

      setCurrentUserRole(membership.role);

      const { data: competitionData, error: competitionError } = await supabase
        .from("competitions")
        .select(
          "id, name, sport_code, season, status, visibility, invite_code, member_limit",
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
      await loadRoundsAndFixtures();
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
  }, [router, competitionId, loadRoundsAndFixtures]);

  function updateFixtureForm(
    roundId: string,
    field: keyof FixtureForm,
    value: string,
  ) {
    setFixtureForms((prev) => ({
      ...prev,
      [roundId]: {
        ...emptyFixtureForm,
        ...prev[roundId],
        [field]: value,
      },
    }));
  }

  async function handleCreateRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const trimmedName = roundName.trim();
    if (!trimmedName) {
      return;
    }

    setRoundSubmitting(true);
    setRoundsError(null);

    const supabase = getSupabaseClient();
    const nextRoundNumber =
      rounds.reduce((max, round) => Math.max(max, round.round_number ?? 0), 0) +
      1;

    const { error: insertError } = await supabase.from("rounds").insert({
      competition_id: competitionId,
      name: trimmedName,
      round_number: nextRoundNumber,
      lock_time: roundLockTime ? new Date(roundLockTime).toISOString() : null,
    });

    setRoundSubmitting(false);

    if (insertError) {
      setRoundsError(insertError.message);
      return;
    }

    setRoundName("");
    setRoundLockTime("");
    await loadRoundsAndFixtures();
  }

  async function handleCreateFixture(
    event: FormEvent<HTMLFormElement>,
    roundId: string,
  ) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const form = fixtureForms[roundId] ?? emptyFixtureForm;
    const homeTeam = form.home.trim();
    const awayTeam = form.away.trim();

    if (!homeTeam || !awayTeam || !form.kickoff) {
      setRoundsError("Home team, away team, and kickoff are required.");
      return;
    }

    setFixtureSubmitting(roundId);
    setRoundsError(null);

    const supabase = getSupabaseClient();
    const { error: insertError } = await supabase.from("fixtures").insert({
      competition_id: competitionId,
      round_id: roundId,
      home_team: homeTeam,
      away_team: awayTeam,
      starts_at: new Date(form.kickoff).toISOString(),
    });

    setFixtureSubmitting(null);

    if (insertError) {
      setRoundsError(insertError.message);
      return;
    }

    setFixtureForms((prev) => ({
      ...prev,
      [roundId]: emptyFixtureForm,
    }));
    await loadRoundsAndFixtures();
  }

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
          <h2 className="text-lg font-semibold text-slate-900">
            Rounds & Fixtures
          </h2>

          {roundsError ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {roundsError}
            </p>
          ) : null}

          {canManage ? (
            <form
              onSubmit={handleCreateRound}
              className="mt-4 rounded-xl border border-blue-100 bg-white p-5"
            >
              <h3 className="text-sm font-semibold text-slate-900">Add round</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="roundName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Round name
                  </label>
                  <input
                    id="roundName"
                    type="text"
                    required
                    value={roundName}
                    onChange={(event) => setRoundName(event.target.value)}
                    className={inputClassName}
                    placeholder="Round 1"
                  />
                </div>
                <div>
                  <label
                    htmlFor="roundLockTime"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Lockout (optional)
                  </label>
                  <input
                    id="roundLockTime"
                    type="datetime-local"
                    value={roundLockTime}
                    onChange={(event) => setRoundLockTime(event.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={roundSubmitting}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {roundSubmitting ? "Adding…" : "Add round"}
              </button>
            </form>
          ) : null}

          {rounds.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
              No rounds yet
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {rounds.map((round) => {
                const roundFixtures = fixtures.filter(
                  (fixture) => fixture.round_id === round.id,
                );
                const form = fixtureForms[round.id] ?? emptyFixtureForm;

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
                        No fixtures yet
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

                    {canManage ? (
                      <form
                        onSubmit={(event) =>
                          handleCreateFixture(event, round.id)
                        }
                        className="mt-4 border-t border-blue-50 pt-4"
                      >
                        <h4 className="text-sm font-semibold text-slate-900">
                          Add fixture
                        </h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div>
                            <label
                              htmlFor={`home-${round.id}`}
                              className="block text-sm font-medium text-slate-700"
                            >
                              Home team
                            </label>
                            <input
                              id={`home-${round.id}`}
                              type="text"
                              required
                              value={form.home}
                              onChange={(event) =>
                                updateFixtureForm(
                                  round.id,
                                  "home",
                                  event.target.value,
                                )
                              }
                              className={inputClassName}
                              placeholder="Blues"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`away-${round.id}`}
                              className="block text-sm font-medium text-slate-700"
                            >
                              Away team
                            </label>
                            <input
                              id={`away-${round.id}`}
                              type="text"
                              required
                              value={form.away}
                              onChange={(event) =>
                                updateFixtureForm(
                                  round.id,
                                  "away",
                                  event.target.value,
                                )
                              }
                              className={inputClassName}
                              placeholder="Crusaders"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`kickoff-${round.id}`}
                              className="block text-sm font-medium text-slate-700"
                            >
                              Kickoff
                            </label>
                            <input
                              id={`kickoff-${round.id}`}
                              type="datetime-local"
                              required
                              value={form.kickoff}
                              onChange={(event) =>
                                updateFixtureForm(
                                  round.id,
                                  "kickoff",
                                  event.target.value,
                                )
                              }
                              className={inputClassName}
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={fixtureSubmitting === round.id}
                          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {fixtureSubmitting === round.id
                            ? "Adding…"
                            : "Add fixture"}
                        </button>
                      </form>
                    ) : null}
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
