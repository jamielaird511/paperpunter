"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const inputClassName =
  "mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

type SeasonDetails = {
  id: string;
  name: string;
  year: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  sportName: string;
  leagueName: string;
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

function normalizeName(
  row: { name: string } | { name: string }[] | null | undefined,
): string {
  if (!row) {
    return "Unknown";
  }

  if (Array.isArray(row)) {
    return row[0]?.name ?? "Unknown";
  }

  return row.name;
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

export default function AdminSeasonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = params.id as string;

  const [season, setSeason] = useState<SeasonDetails | null>(null);
  const [rounds, setRounds] = useState<SourceRound[]>([]);
  const [fixtures, setFixtures] = useState<SourceFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [roundName, setRoundName] = useState("");
  const [roundLockTime, setRoundLockTime] = useState("");
  const [roundSubmitting, setRoundSubmitting] = useState(false);

  const [fixtureForms, setFixtureForms] = useState<
    Record<string, { home: string; away: string; kickoff: string }>
  >({});
  const [fixtureSubmitting, setFixtureSubmitting] = useState<string | null>(
    null,
  );

  const loadSeasonData = useCallback(async () => {
    const supabase = getSupabaseClient();

    const { data: seasonData, error: seasonError } = await supabase
      .from("seasons")
      .select(
        `
        id,
        name,
        year,
        starts_at,
        ends_at,
        status,
        leagues (
          name,
          sports (
            name
          )
        )
      `,
      )
      .eq("id", seasonId)
      .single();

    if (seasonError || !seasonData) {
      setError(seasonError?.message ?? "Season not found.");
      return false;
    }

    const league = seasonData.leagues as
      | { name: string; sports: { name: string } | { name: string }[] | null }
      | { name: string; sports: { name: string } | { name: string }[] | null }[]
      | null;
    const leagueRecord = Array.isArray(league) ? league[0] : league;

    setSeason({
      id: seasonData.id,
      name: seasonData.name,
      year: seasonData.year,
      starts_at: seasonData.starts_at,
      ends_at: seasonData.ends_at,
      status: seasonData.status,
      leagueName: leagueRecord?.name ?? "Unknown league",
      sportName: normalizeName(leagueRecord?.sports),
    });

    const { data: roundsData, error: roundsError } = await supabase
      .from("source_rounds")
      .select("id, name, round_number, lock_time")
      .eq("season_id", seasonId)
      .order("round_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (roundsError) {
      setActionError(roundsError.message);
      return false;
    }

    const roundList = roundsData ?? [];
    setRounds(roundList);

    if (roundList.length === 0) {
      setFixtures([]);
      setActionError(null);
      return true;
    }

    const roundIds = roundList.map((round) => round.id);
    const { data: fixturesData, error: fixturesError } = await supabase
      .from("source_fixtures")
      .select("id, source_round_id, home_team, away_team, starts_at")
      .in("source_round_id", roundIds)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (fixturesError) {
      setActionError(fixturesError.message);
      return false;
    }

    setFixtures(fixturesData ?? []);
    setActionError(null);
    return true;
  }, [seasonId]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function loadPage() {
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

      await loadSeasonData();
      setLoading(false);
    }

    loadPage();
  }, [router, loadSeasonData]);

  function updateFixtureForm(
    roundId: string,
    field: "home" | "away" | "kickoff",
    value: string,
  ) {
    setFixtureForms((prev) => ({
      ...prev,
      [roundId]: {
        ...{ home: "", away: "", kickoff: "" },
        ...prev[roundId],
        [field]: value,
      },
    }));
  }

  async function handleCreateRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    const trimmedName = roundName.trim();
    if (!trimmedName) {
      return;
    }

    setRoundSubmitting(true);
    const supabase = getSupabaseClient();
    const nextRoundNumber =
      rounds.reduce((max, round) => Math.max(max, round.round_number ?? 0), 0) +
      1;

    const { error: insertError } = await supabase.from("source_rounds").insert({
      season_id: seasonId,
      name: trimmedName,
      round_number: nextRoundNumber,
      lock_time: roundLockTime ? new Date(roundLockTime).toISOString() : null,
    });

    setRoundSubmitting(false);

    if (insertError) {
      setActionError(insertError.message);
      return;
    }

    setRoundName("");
    setRoundLockTime("");
    await loadSeasonData();
  }

  async function handleCreateFixture(
    event: FormEvent<HTMLFormElement>,
    roundId: string,
  ) {
    event.preventDefault();
    setActionError(null);

    const form = fixtureForms[roundId] ?? { home: "", away: "", kickoff: "" };
    const homeTeam = form.home.trim();
    const awayTeam = form.away.trim();

    if (!homeTeam || !awayTeam || !form.kickoff) {
      setActionError("Home team, away team, and kickoff are required.");
      return;
    }

    setFixtureSubmitting(roundId);
    const supabase = getSupabaseClient();

    const { error: insertError } = await supabase.from("source_fixtures").insert({
      source_round_id: roundId,
      home_team: homeTeam,
      away_team: awayTeam,
      starts_at: new Date(form.kickoff).toISOString(),
    });

    setFixtureSubmitting(null);

    if (insertError) {
      setActionError(insertError.message);
      return;
    }

    setFixtureForms((prev) => ({
      ...prev,
      [roundId]: { home: "", away: "", kickoff: "" },
    }));
    await loadSeasonData();
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

  if (error || !season) {
    return (
      <div className="min-h-full bg-slate-50 font-sans">
        <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          <Link
            href="/admin/seasons"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            ← Seasons
          </Link>
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? "Season not found."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-blue-700">PaperPunter Admin</span>
          <Link
            href="/admin/seasons"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Seasons
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/admin/seasons"
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Back to seasons
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          {season.name}
        </h1>
        <p className="mt-2 text-slate-600">
          {season.sportName} · {season.leagueName}
          {season.year ? ` · ${season.year}` : null}
        </p>

        <section className="mt-8 rounded-xl border border-blue-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Season details</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium capitalize text-slate-900">
                {season.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Start</dt>
              <dd className="font-medium text-slate-900">
                {season.starts_at ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">End</dt>
              <dd className="font-medium text-slate-900">
                {season.ends_at ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Rounds</h2>

          {actionError ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          ) : null}

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

          {rounds.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
              No rounds yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {rounds.map((round) => {
                const roundFixtures = fixtures.filter(
                  (fixture) => fixture.source_round_id === round.id,
                );
                const form = fixtureForms[round.id] ?? {
                  home: "",
                  away: "",
                  kickoff: "",
                };

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

                    <form
                      onSubmit={(event) => handleCreateFixture(event, round.id)}
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
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
