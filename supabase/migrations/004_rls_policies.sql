-- Formations: public sees only active (non-tombstoned), owner can update
-- No DELETE policy — formations are soft-deleted only
alter table formations enable row level security;
create policy "public read active" on formations for select
  using (deleted_at is null);
create policy "owner read own" on formations for select
  using (auth.uid() = owner_id);
create policy "owner insert" on formations for insert
  with check (auth.uid() = owner_id);
create policy "owner update" on formations for update
  using (auth.uid() = owner_id);

-- Versions: public sees only 'published' on active formations
-- No direct DELETE via RLS — unpublish goes through API (service-role)
alter table formation_versions enable row level security;
create policy "public read published" on formation_versions for select
  using (status = 'published' and exists (
    select 1 from formations where id = formation_id and deleted_at is null
  ));
create policy "owner read own" on formation_versions for select
  using (exists (
    select 1 from formations where id = formation_id and owner_id = auth.uid()
  ));
create policy "owner insert" on formation_versions for insert
  with check (exists (
    select 1 from formations where id = formation_id and owner_id = auth.uid()
  ));

-- Stars: public read, users manage their own
alter table stars enable row level security;
create policy "public read"  on stars for select using (true);
create policy "own stars"    on stars for insert with check (auth.uid() = user_id);
create policy "own unstars"  on stars for delete using (auth.uid() = user_id);

-- Tokens: users see and manage only their own
alter table api_tokens enable row level security;
create policy "own tokens" on api_tokens for select using (auth.uid() = user_id);
create policy "own insert" on api_tokens for insert with check (auth.uid() = user_id);
create policy "own update" on api_tokens for update using (auth.uid() = user_id);
