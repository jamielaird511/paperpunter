-- Allow authenticated users to manage platform fixture data for MVP admin loader.
-- No role checks yet — replace with admin-only policies later.

create policy "Authenticated users can insert sports"
on public.sports
for insert
to authenticated
with check (true);

create policy "Authenticated users can insert leagues"
on public.leagues
for insert
to authenticated
with check (true);

create policy "Authenticated users can insert seasons"
on public.seasons
for insert
to authenticated
with check (true);

create policy "Authenticated users can insert source rounds"
on public.source_rounds
for insert
to authenticated
with check (true);

create policy "Authenticated users can insert source fixtures"
on public.source_fixtures
for insert
to authenticated
with check (true);
