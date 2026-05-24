"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type SeasonRow = {
  id: string;
  name: string;
  year: number | null;
  status: string;
  leagueName: string;
  sportName: string;
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

export default function AdminSeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function loadSeasons() {
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

      const { data, error: fetchError } = await supabase
        .from("seasons")
        .select(
          `
          id,
          name,
          year,
          status,
          leagues (
            name,
            sports (
              name
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []).map((season) => {
        const league = season.leagues as
          | { name: string; sports: { name: string } | { name: string }[] | null }
          | { name: string; sports: { name: string } | { name: string }[] | null }[]
          | null;

        const leagueRecord = Array.isArray(league) ? league[0] : league;
        const sportRecord = leagueRecord?.sports;

        return {
          id: season.id,
          name: season.name,
          year: season.year,
          status: season.status,
          leagueName: leagueRecord?.name ?? "Unknown league",
          sportName: normalizeName(sportRecord),
        };
      });

      setSeasons(rows);
      setLoading(false);
    }

    loadSeasons();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 font-sans">
        <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          <p className="text-slate-600">Loading…</p>
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
            href="/dashboard"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Fixture sets
            </h1>
            <p className="mt-2 text-slate-600">
              Platform seasons, rounds, and fixtures.
            </p>
          </div>
          <Link
            href="/admin/seasons/new"
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New season
          </Link>
        </div>

        {error ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {seasons.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
            No seasons yet. Create one to load fixture data.
          </p>
        ) : (
          <ul className="mt-8 space-y-2">
            {seasons.map((season) => (
              <li key={season.id}>
                <Link
                  href={`/admin/seasons/${season.id}`}
                  className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3 hover:border-blue-300"
                >
                  <div>
                    <p className="font-medium text-slate-900">{season.name}</p>
                    <p className="text-sm text-slate-600">
                      {season.sportName} · {season.leagueName}
                      {season.year ? ` · ${season.year}` : null}
                    </p>
                  </div>
                  <span className="text-sm capitalize text-slate-500">
                    {season.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
