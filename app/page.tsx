export default function Home() {
  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold tracking-tight text-blue-700">
            PaperPunter
          </span>
          <nav className="flex items-center gap-3 sm:gap-4">
            <a
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-blue-700"
            >
              Log In
            </a>
            <a
              href="/signup"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:px-4"
            >
              Create Competition
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Hero — organiser-first */}
        <section className="py-10 sm:py-14 lg:py-16">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-blue-600">
              For whoever runs the office comp
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Office kudos. Zero admin.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 sm:text-xl">
              Run the comp everyone actually talks about — tradie shed, sales
              floor, or Friday arvo mates. No spreadsheets. No chasing Steve
              for his picks. You look like a legend; PaperPunter keeps the
              season moving.
            </p>
            <p className="mt-3 text-base text-slate-500">
              Set it up once. Monday morning leaderboard arguments included.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <a
                href="/signup"
                className="rounded-lg bg-blue-600 px-6 py-3 text-center text-base font-semibold text-white hover:bg-blue-700"
              >
                Create Competition
              </a>
              <a
                href="/login"
                className="rounded-lg border border-blue-200 bg-white px-6 py-3 text-center text-base font-semibold text-blue-700 hover:bg-blue-50"
              >
                Join a Comp
              </a>
            </div>
          </div>
        </section>

        {/* Featured comp — social proof up front */}
        <section className="border-t border-blue-100 py-10 sm:py-14">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            This is what a live comp looks like
          </h2>
          <p className="mt-2 max-w-lg text-slate-600">
            Picks in, ladder updated, mates already arguing. No manual
            anything.
          </p>
          <article className="mt-6 max-w-md overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
            <div className="bg-blue-600 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-blue-100">
                    AFL · Private · 24 players
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white sm:text-xl">
                    Henderson Bros Site Office
                  </h3>
                </div>
                <span className="shrink-0 rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white">
                  Live
                </span>
              </div>
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-semibold">Round 14 tips close</span>{" "}
                Fri 7:30pm · 18 of 24 tipped
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-blue-50 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Leading</p>
                  <p className="font-semibold text-slate-900">Sarah M.</p>
                  <p className="text-blue-700">142 pts · +3 this week</p>
                </div>
                <div className="rounded-lg border border-blue-50 bg-slate-50 px-3 py-2">
                  <p className="text-slate-500">Last round</p>
                  <p className="font-semibold text-slate-900">Dave tipped 7/8</p>
                  <p className="text-slate-600">Steve tipped 3. Classic Steve.</p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-3 py-2.5 text-sm text-slate-700">
                <span className="font-semibold text-blue-800">Gazza:</span>{" "}
                &ldquo;Steve&apos;s tipping like he&apos;s picking lunch, not
                ladder spots.&rdquo;
              </div>
              <a
                href="#"
                className="block w-full rounded-lg border border-blue-200 py-2.5 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Peek the ladder
              </a>
            </div>
          </article>
        </section>

        {/* Benefits — conversational, outcome-led */}
        <section className="border-t border-blue-100 py-10 sm:py-14">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            You run the banter. We run the boring stuff.
          </h2>
          <p className="mt-2 max-w-xl text-slate-600">
            Set it up once. PaperPunter handles scoring, reminders, and the
            weekly noise so you can take the credit.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "No more chasing picks",
                description:
                  "Reminders go out. Steve still forgets sometimes — but that's on Steve.",
              },
              {
                title: "Leaderboard updates itself",
                description:
                  "Scores land, ladder shifts, Monday morning arguments start on time.",
              },
              {
                title: "Tip from the smoko break",
                description:
                  "Mobile picks in seconds. No logins through a spreadsheet link.",
              },
              {
                title: "Gazza brings the weekly banter",
                description:
                  "Funny wrap-ups and gentle sledging that keep people coming back.",
              },
            ].map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-xl border border-blue-100 bg-white p-5"
              >
                <h3 className="font-semibold text-slate-900">{benefit.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {benefit.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Organiser CTA strip */}
        <section className="border-t border-blue-100 py-10 sm:py-12">
          <div className="rounded-xl bg-blue-600 px-5 py-8 text-center sm:px-8">
            <p className="text-lg font-bold text-white sm:text-xl">
              Ready to be the comp hero?
            </p>
            <p className="mt-2 text-sm text-blue-100 sm:text-base">
              Offices, tradie crews, dealerships, pubs — if they talk footy,
              they&apos;ll tip.
            </p>
            <a
              href="/signup"
              className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-base font-semibold text-blue-700 hover:bg-blue-50"
            >
              Create Competition
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-blue-100 bg-white py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-slate-500 sm:px-6">
          PaperPunter — the comp everyone actually talks about.
        </div>
      </footer>
    </div>
  );
}
