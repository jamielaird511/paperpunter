"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
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
          Your dashboard is coming soon. Comps, picks, and ladders land here
          next.
        </p>

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
