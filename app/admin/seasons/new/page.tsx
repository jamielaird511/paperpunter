"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const CREATE_NEW_SPORT = "__new__";

const inputClassName =
  "mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

type SportOption = {
  id: string;
  name: string;
  slug: string;
};

function toSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export default function NewAdminSeasonPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [sportSelection, setSportSelection] = useState("");
  const [newSportName, setNewSportName] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [year, setYear] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [showDebugSlugs, setShowDebugSlugs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCreatingSport = sportSelection === CREATE_NEW_SPORT;
  const sportSlug = isCreatingSport ? toSlug(newSportName) : "";
  const leagueSlug = toSlug(leagueName);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function loadPage() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: sportsData, error: sportsError } = await supabase
        .from("sports")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (sportsError) {
        setError(sportsError.message);
        setAuthChecked(true);
        return;
      }

      const options = sportsData ?? [];
      setSports(options);
      if (options.length > 0) {
        setSportSelection(options[0].id);
      } else {
        setSportSelection(CREATE_NEW_SPORT);
      }
      setAuthChecked(true);
    }

    loadPage();
  }, [router]);

  async function findOrCreateSport(
    name: string,
    slug: string,
  ): Promise<{ id: string } | { error: string }> {
    const supabase = getSupabaseClient();

    const { data: existing, error: fetchError } = await supabase
      .from("sports")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (fetchError) {
      return { error: fetchError.message };
    }

    if (existing) {
      return { id: existing.id };
    }

    const { data: created, error: insertError } = await supabase
      .from("sports")
      .insert({ name, slug })
      .select("id")
      .single();

    if (insertError || !created) {
      return { error: insertError?.message ?? "Could not create sport." };
    }

    return { id: created.id };
  }

  async function findOrCreateLeague(
    sportId: string,
    name: string,
    slug: string,
  ): Promise<{ id: string } | { error: string }> {
    const supabase = getSupabaseClient();

    const { data: existing, error: fetchError } = await supabase
      .from("leagues")
      .select("id")
      .eq("sport_id", sportId)
      .eq("slug", slug)
      .maybeSingle();

    if (fetchError) {
      return { error: fetchError.message };
    }

    if (existing) {
      return { id: existing.id };
    }

    const { data: created, error: insertError } = await supabase
      .from("leagues")
      .insert({ sport_id: sportId, name, slug })
      .select("id")
      .single();

    if (insertError || !created) {
      return { error: insertError?.message ?? "Could not create league." };
    }

    return { id: created.id };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedLeagueName = leagueName.trim();
    const trimmedSeasonName = seasonName.trim();
    const trimmedLeagueSlug = toSlug(trimmedLeagueName);

    if (!sportSelection) {
      setError("Please select a sport.");
      return;
    }

    if (isCreatingSport && !newSportName.trim()) {
      setError("Sport name is required.");
      return;
    }

    if (!trimmedLeagueName || !trimmedSeasonName || !trimmedLeagueSlug) {
      setError("League and season names are required.");
      return;
    }

    const parsedYear = year.trim() ? Number(year) : null;
    if (parsedYear !== null && Number.isNaN(parsedYear)) {
      setError("Year must be a number.");
      return;
    }

    setLoading(true);

    let sportId: string;

    if (isCreatingSport) {
      const trimmedSportName = newSportName.trim();
      const sportResult = await findOrCreateSport(
        trimmedSportName,
        toSlug(trimmedSportName),
      );
      if ("error" in sportResult) {
        setLoading(false);
        setError(sportResult.error);
        return;
      }
      sportId = sportResult.id;
    } else {
      sportId = sportSelection;
    }

    const leagueResult = await findOrCreateLeague(
      sportId,
      trimmedLeagueName,
      trimmedLeagueSlug,
    );
    if ("error" in leagueResult) {
      setLoading(false);
      setError(leagueResult.error);
      return;
    }

    const supabase = getSupabaseClient();
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .insert({
        league_id: leagueResult.id,
        name: trimmedSeasonName,
        year: parsedYear,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        status: "draft",
      })
      .select("id")
      .single();

    setLoading(false);

    if (seasonError || !season) {
      setError(seasonError?.message ?? "Could not create season.");
      return;
    }

    router.push(`/admin/seasons/${season.id}`);
  }

  if (!authChecked) {
    return (
      <div className="min-h-full bg-slate-50 font-sans">
        <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
          <p className="text-slate-600">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-blue-700">PaperPunter Admin</span>
          <Link
            href="/admin/seasons"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Seasons
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
        <Link
          href="/admin/seasons"
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Back to seasons
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          New fixture set
        </h1>
        <p className="mt-2 text-slate-600">
          Pick a sport and league, then name the season. Existing leagues are
          reused automatically.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="sport"
              className="block text-sm font-medium text-slate-700"
            >
              Sport
            </label>
            <select
              id="sport"
              required
              value={sportSelection}
              onChange={(event) => setSportSelection(event.target.value)}
              className={inputClassName}
            >
              {sports.length === 0 ? (
                <option value={CREATE_NEW_SPORT}>Create new sport</option>
              ) : (
                <>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                  <option value={CREATE_NEW_SPORT}>Create new sport</option>
                </>
              )}
            </select>
          </div>

          {isCreatingSport ? (
            <div>
              <label
                htmlFor="newSportName"
                className="block text-sm font-medium text-slate-700"
              >
                New sport name
              </label>
              <input
                id="newSportName"
                type="text"
                required
                value={newSportName}
                onChange={(event) => setNewSportName(event.target.value)}
                className={inputClassName}
                placeholder="Rugby Union"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="leagueName"
              className="block text-sm font-medium text-slate-700"
            >
              League
            </label>
            <input
              id="leagueName"
              type="text"
              required
              value={leagueName}
              onChange={(event) => setLeagueName(event.target.value)}
              className={inputClassName}
              placeholder="NPC"
            />
          </div>

          <div>
            <label
              htmlFor="seasonName"
              className="block text-sm font-medium text-slate-700"
            >
              Season name
            </label>
            <input
              id="seasonName"
              type="text"
              required
              value={seasonName}
              onChange={(event) => setSeasonName(event.target.value)}
              className={inputClassName}
              placeholder="NPC 2026"
            />
          </div>

          <div>
            <label
              htmlFor="year"
              className="block text-sm font-medium text-slate-700"
            >
              Year
            </label>
            <input
              id="year"
              type="number"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className={inputClassName}
              placeholder="2026"
            />
          </div>

          <div>
            <label
              htmlFor="startsAt"
              className="block text-sm font-medium text-slate-700"
            >
              Start date (optional)
            </label>
            <input
              id="startsAt"
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="endsAt"
              className="block text-sm font-medium text-slate-700"
            >
              End date (optional)
            </label>
            <input
              id="endsAt"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className={inputClassName}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowDebugSlugs((current) => !current)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showDebugSlugs ? "Hide slugs" : "Show slugs (debug)"}
          </button>

          {showDebugSlugs ? (
            <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600">
              {isCreatingSport ? (
                <p>Sport slug: {sportSlug || "—"}</p>
              ) : (
                <p>
                  Sport slug:{" "}
                  {sports.find((sport) => sport.id === sportSelection)?.slug ??
                    "—"}
                </p>
              )}
              <p className="mt-1">League slug: {leagueSlug || "—"}</p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create season"}
          </button>
        </form>
      </main>
    </div>
  );
}
