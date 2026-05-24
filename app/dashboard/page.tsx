"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type UserCompetition = {
  id: string;
  name: string;
  sport_code: string;
  season: string | null;
  status: string;
  visibility: string;
  invite_code: string;
  member_limit: number;
  role: string;
};

function formatSportCode(code: string): string {
  return code
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [competitions, setCompetitions] = useState<UserCompetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        router.replace("/login");
        return;
      }

      setUser(authUser);

      const { data, error: fetchError } = await supabase
        .from("competition_members")
        .select(
          `
          role,
          competitions (
            id,
            name,
            sport_code,
            season,
            status,
            visibility,
            invite_code,
            member_limit
          )
        `,
        )
        .eq("user_id", authUser.id)
        .eq("status", "active");

      if (fetchError) {
        setError(fetchError.message);
        setCompetitions([]);
      } else {
        const items = (data ?? [])
          .filter((row) => row.competitions !== null)
          .map((row) => ({
            ...(row.competitions as Omit<UserCompetition, "role">),
            role: row.role,
          }));
        setCompetitions(items);
      }

      setLoading(false);
    }

    loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isLoggingOutRef.current) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    isLoggingOutRef.current = true;
    let signedOut = false;

    try {
      const supabase = getSupabaseClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error("[dashboard] signOut error:", signOutError);
        return;
      }

      signedOut = true;
      router.replace("/");
    } catch (err) {
      console.error("[dashboard] signOut error:", err);
    } finally {
      setLoggingOut(false);
      if (!signedOut) {
        isLoggingOutRef.current = false;
      }
    }
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

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "there";

  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-blue-700">PaperPunter</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          G&apos;day, {displayName}
        </h1>
        <p className="mt-2 text-slate-600">
          Your comps, all in one place.
        </p>

        <Link
          href="/dashboard/create-competition"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700"
        >
          Create Competition
        </Link>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">
            Your competitions
          </h2>

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {!error && competitions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-8 text-center">
              <p className="font-medium text-slate-900">No competitions yet</p>
              <p className="mt-2 text-sm text-slate-600">
                Create your first comp and share the invite code with your
                mates.
              </p>
            </div>
          ) : null}

          {!error && competitions.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {competitions.map((competition) => (
                <li
                  key={competition.id}
                  className="rounded-xl border border-blue-100 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {competition.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatSportCode(competition.sport_code)}
                        {competition.season
                          ? ` · ${competition.season}`
                          : null}
                      </p>
                    </div>
                    {competition.role === "owner" ? (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        Owner
                      </span>
                    ) : null}
                  </div>
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
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="mt-8 rounded-xl border border-blue-100 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Signed in as</p>
          <p className="mt-1 font-semibold text-slate-900">{user?.email}</p>
        </div>

        <Link
          href="/"
          className="mt-6 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Back to homepage
        </Link>
      </main>
    </div>
  );
}
