"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const VISIBILITY_OPTIONS = [
  { label: "Private", value: "private" },
  { label: "Unlisted", value: "unlisted" },
  { label: "Public", value: "public" },
] as const;

const inputClassName =
  "mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

type FixtureSetOption = {
  id: string;
  label: string;
  sportSlug: string;
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "comp"}-${suffix}`;
}

function sportSlugToCode(slug: string): string {
  return slug.replace(/-/g, "_") || "other";
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

export default function CreateCompetitionPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [fixtureSets, setFixtureSets] = useState<FixtureSetOption[]>([]);
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [visibility, setVisibility] = useState<string>("private");
  const [memberLimit, setMemberLimit] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      const { data: seasonsData, error: seasonsError } = await supabase
        .from("seasons")
        .select(
          `
          id,
          name,
          leagues (
            sports (
              slug
            )
          )
        `,
        )
        .order("name", { ascending: true });

      if (seasonsError) {
        setError(seasonsError.message);
        setAuthChecked(true);
        return;
      }

      const options = (seasonsData ?? []).map((season) => {
        const league = season.leagues as
          | { sports: { slug: string } | { slug: string }[] | null }
          | { sports: { slug: string } | { slug: string }[] | null }[]
          | null;
        const leagueRecord = Array.isArray(league) ? league[0] : league;
        const sport = leagueRecord?.sports;
        const sportRecord = Array.isArray(sport) ? sport[0] : sport;

        return {
          id: season.id,
          label: season.name,
          sportSlug: sportRecord?.slug ?? "other",
        };
      });

      setFixtureSets(options);
      if (options.length > 0) {
        setSeasonId(options[0].id);
      }
      setAuthChecked(true);
    }

    loadPage();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Competition name is required.");
      return;
    }

    if (!seasonId) {
      setError("Please select a fixture set.");
      return;
    }

    if (memberLimit < 1) {
      setError("Member limit must be at least 1.");
      return;
    }

    const selectedFixtureSet = fixtureSets.find(
      (fixtureSet) => fixtureSet.id === seasonId,
    );
    if (!selectedFixtureSet) {
      setError("Please select a valid fixture set.");
      return;
    }

    setLoading(true);

    const supabase = getSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const competitionPayload = {
      name: trimmedName,
      slug: slugify(trimmedName),
      season_id: seasonId,
      sport_code: sportSlugToCode(selectedFixtureSet.sportSlug),
      season: selectedFixtureSet.label,
      created_by: user.id,
      invite_code: generateInviteCode(),
      visibility,
      status: "draft",
      member_limit: memberLimit,
    };

    const { data: competition, error: competitionError } = await supabase
      .from("competitions")
      .insert(competitionPayload)
      .select("id")
      .single();

    if (competitionError || !competition) {
      setLoading(false);
      setError(competitionError?.message ?? "Could not create competition.");
      return;
    }

    const { error: memberError } = await supabase
      .from("competition_members")
      .insert({
        competition_id: competition.id,
        user_id: user.id,
        role: "owner",
        status: "active",
      });

    if (memberError) {
      await supabase.from("competitions").delete().eq("id", competition.id);
      setLoading(false);
      setError(memberError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
          <span className="text-lg font-bold text-blue-700">PaperPunter</span>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Create a competition
        </h1>
        <p className="mt-2 text-slate-600">
          Pick a fixture set and name your comp. Rounds and fixtures come
          automatically.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700"
            >
              Competition name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClassName}
              placeholder="Dave's Office NPC Comp"
            />
          </div>

          <div>
            <label
              htmlFor="fixtureSet"
              className="block text-sm font-medium text-slate-700"
            >
              Fixture set
            </label>
            {fixtureSets.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-blue-200 bg-white px-3 py-2 text-sm text-slate-600">
                No fixture sets available yet. Ask an admin to load seasons
                first.
              </p>
            ) : (
              <select
                id="fixtureSet"
                name="fixtureSet"
                required
                value={seasonId}
                onChange={(event) => setSeasonId(event.target.value)}
                className={inputClassName}
              >
                {fixtureSets.map((fixtureSet) => (
                  <option key={fixtureSet.id} value={fixtureSet.id}>
                    {fixtureSet.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="visibility"
              className="block text-sm font-medium text-slate-700"
            >
              Visibility
            </label>
            <select
              id="visibility"
              name="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className={inputClassName}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="memberLimit"
              className="block text-sm font-medium text-slate-700"
            >
              Member limit
            </label>
            <input
              id="memberLimit"
              name="memberLimit"
              type="number"
              min={1}
              required
              value={memberLimit}
              onChange={(event) => setMemberLimit(Number(event.target.value))}
              className={inputClassName}
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || fixtureSets.length === 0}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create competition"}
          </button>
        </form>
      </main>
    </div>
  );
}
