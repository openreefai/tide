create or replace function increment_downloads(formation_name text)
returns void as $$
begin
  update formations
  set total_downloads = total_downloads + 1
  where name = formation_name and deleted_at is null;
end;
$$ language plpgsql security definer;

-- Star-sorted formation listing (used by sort=stars in list API).
-- Returns total_count via window function so the caller gets pagination totals
-- without a second query. The .rpc() call doesn't support { count: 'exact' }
-- like .from().select() does — total must come from the result rows.
create or replace function list_formations_by_stars(
  p_type text default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
) returns table (
  id uuid, name text, description text, type text, license text,
  latest_version text, total_downloads int, created_at timestamptz,
  updated_at timestamptz, owner_id uuid, star_count bigint,
  total_count bigint
) as $$
begin
  return query
    select f.id, f.name, f.description, f.type, f.license,
           f.latest_version, f.total_downloads, f.created_at,
           f.updated_at, f.owner_id, count(s.user_id) as star_count,
           count(*) over() as total_count
    from formations f
    left join stars s on s.formation_id = f.id
    where f.deleted_at is null
      and (p_type is null or f.type = p_type)
      and (p_query is null or f.name ilike '%' || p_query || '%'
           or f.description ilike '%' || p_query || '%')
    group by f.id
    order by star_count desc, f.created_at desc
    limit p_limit offset p_offset;
end;
$$ language plpgsql security definer stable;
