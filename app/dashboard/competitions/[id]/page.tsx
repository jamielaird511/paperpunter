"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

function formatSportCode(code: string): string {
  return code
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setCompetition(competitionData);
        setMembers([]);
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
  }, [router, competitionId]);

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
          <h2 className="text-lg font-semibold text-slate-900">Fixtures</h2>
          <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-5 py-6 text-sm text-slate-600">
            Fixtures coming soon. Rounds and matches will show up here.
          </p>
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
