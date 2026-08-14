-- ============================================================
-- Campus Plant Navigation — Supabase SQL Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run, and safe to run on top of an earlier version of this
-- schema — every step is guarded (IF EXISTS / IF NOT EXISTS / DO blocks
-- that check information_schema first), so it upgrades an existing
-- database in place instead of erroring or duplicating objects.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fast ILIKE '%q%' search on plant_name

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  points      integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Base table for a fresh install. If this project already has a `plants`
-- table from an earlier, richer schema, the migration block below brings
-- it in line with the simplified shape (renames + drops columns) instead
-- of touching this CREATE at all.
create table if not exists plants (
  id             uuid primary key default uuid_generate_v4(),
  plant_name     text not null,
  photo_url      text,
  latitude       double precision not null check (latitude between -90 and 90),
  longitude      double precision not null check (longitude between -180 and 180),
  landmark       text,
  submitted_by   uuid references profiles(id) on delete set null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified_by    uuid references profiles(id) on delete set null,
  verified_at    timestamptz,
  points_awarded integer not null default 0, -- points already granted for THIS record; prevents double-pay on re-save
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MIGRATION: bring an existing (older/richer) `plants` table down to
-- the simplified shape the app now uses. Every step only runs if it
-- still needs to.
-- ------------------------------------------------------------
do $$
begin
  -- common_name -> plant_name
  if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'common_name')
     and not exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'plant_name') then
    alter table plants rename column common_name to plant_name;
  end if;

  -- image_url -> photo_url
  if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'image_url')
     and not exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'photo_url') then
    alter table plants rename column image_url to photo_url;
  end if;
end $$;

-- Drop fields the simplified Add Plant form no longer collects.
alter table plants drop column if exists scientific_name;
alter table plants drop column if exists local_name;
alter table plants drop column if exists plant_type;
alter table plants drop column if exists description;
alter table plants drop column if exists campus_zone;

-- Migrate any existing 'verified' rows to the new 'approved' status name,
-- then swap the check constraint over.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'status') then
    update plants set status = 'approved' where status = 'verified';
  end if;
end $$;

alter table plants drop constraint if exists plants_status_check;
alter table plants add constraint plants_status_check check (status in ('pending', 'approved', 'rejected'));

-- Auto-update updated_at on plants
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plants_updated_at on plants;
create trigger plants_updated_at
  before update on plants
  for each row execute function update_updated_at();

-- ============================================================
-- INDEXES
-- Trigram index makes `plant_name ilike '%q%'` fast even as the table
-- grows into the thousands of rows, instead of a sequential scan.
-- ============================================================

create index if not exists plants_status_idx on plants(status);
create index if not exists plants_submitted_by_idx on plants(submitted_by);
create index if not exists plants_name_trgm_idx on plants using gin (plant_name gin_trgm_ops);
create index if not exists plants_coords_idx on plants(latitude, longitude);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, role, points)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'user',
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- POINTS — awarded ONLY by triggers (never callable directly by clients)
--   +5   when a plant is submitted (insert, status='pending')
--   +10  when a plant is approved (status -> 'approved')
--   +20  bonus if it's the first approved record of that plant name
-- ============================================================

create or replace function award_submission_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    update profiles set points = points + 5 where id = new.submitted_by;
  end if;
  return new;
end;
$$;

drop trigger if exists plants_submit_points on plants;
create trigger plants_submit_points
  after insert on plants
  for each row execute function award_submission_points();

create or replace function award_verification_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bonus integer := 0;
  total integer := 0;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and old.points_awarded = 0 then
    total := 10;

    if (
      select count(*) from plants
      where lower(plant_name) = lower(new.plant_name)
        and status = 'approved'
        and id != new.id
    ) = 0 then
      bonus := 20;
      total := total + bonus;
    end if;

    update profiles set points = points + total where id = new.submitted_by;
    new.points_awarded := total;
    new.verified_at := coalesce(new.verified_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists plants_verify_points on plants;
create trigger plants_verify_points
  before update on plants
  for each row execute function award_verification_points();

-- ============================================================
-- LEADERBOARD
-- ============================================================

create or replace view leaderboard as
select
  p.id,
  p.name,
  p.avatar_url,
  p.points,
  count(pl.id) filter (where pl.status = 'approved') as verified_count,
  rank() over (order by p.points desc) as rank
from profiles p
left join plants pl on pl.submitted_by = p.id
group by p.id, p.name, p.avatar_url, p.points
order by p.points desc;

-- ============================================================
-- DYNAMIC SEARCH — the database is the source of truth.
-- No plant names are hardcoded anywhere in the frontend; every
-- autocomplete suggestion and search result comes from these queries
-- against the live `plants` table.
-- ============================================================

-- Distinct approved plant names matching a prefix/substring, for
-- autocomplete. Returns at most `max_results` distinct names, cheapest
-- (shortest / most common) first so exact-ish matches surface first.
create or replace function search_plant_names(q text, max_results integer default 8)
returns table (plant_name text, match_count integer) language sql stable as $$
  select plant_name, count(*)::int as match_count
  from plants
  where status = 'approved'
    and plant_name ilike '%' || q || '%'
  group by plant_name
  order by (lower(plant_name) = lower(q)) desc, count(*) desc, plant_name asc
  limit max_results;
$$;

-- Every approved physical plant matching an exact name, nearest first
-- when the caller passes the visitor's coordinates (Haversine — no
-- PostGIS dependency). Pass null/null for lat/lon to skip sorting.
create or replace function nearest_plants_by_name(
  plant_name_query text,
  user_lat double precision default null,
  user_lon double precision default null,
  max_results integer default 50
)
returns table (
  id uuid,
  plant_name text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  landmark text,
  created_at timestamptz,
  distance_metres double precision
) language sql stable as $$
  select
    pl.id, pl.plant_name, pl.photo_url, pl.latitude, pl.longitude, pl.landmark, pl.created_at,
    case
      when user_lat is null or user_lon is null then null
      else 2 * 6371000 * asin(sqrt(
        sin(radians(pl.latitude - user_lat) / 2) ^ 2 +
        cos(radians(user_lat)) * cos(radians(pl.latitude)) *
        sin(radians(pl.longitude - user_lon) / 2) ^ 2
      ))
    end as distance_metres
  from plants pl
  where pl.status = 'approved'
    and lower(pl.plant_name) = lower(plant_name_query)
  order by distance_metres asc nulls last
  limit max_results;
$$;

-- Most-contributed approved plant names, for a "Popular" section that's
-- generated from real data instead of a hardcoded list.
create or replace function popular_plant_names(max_results integer default 6)
returns table (plant_name text, total integer) language sql stable as $$
  select plant_name, count(*)::int as total
  from plants
  where status = 'approved'
  group by plant_name
  order by total desc, plant_name asc
  limit max_results;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table plants enable row level security;

-- Policies can't use `IF NOT EXISTS` in Postgres, so each is dropped and
-- recreated — safe to re-run, and always ends up matching this file
-- exactly rather than silently keeping a stale older version.

drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read" on profiles for select using (true);

drop policy if exists "profiles_own_insert" on profiles;
create policy "profiles_own_insert" on profiles for insert
  with check (auth.uid() = id and role = 'user' and points = 0);

drop policy if exists "profiles_own_update" on profiles;
create policy "profiles_own_update" on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from profiles where id = auth.uid())
    and points = (select points from profiles where id = auth.uid())
  );

-- plants: public can read approved rows; owners can read their own
-- (any status); admins can read everything.
drop policy if exists "plants_read" on plants;
create policy "plants_read" on plants for select
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Users may only insert a plant as themselves, and it must start as
-- 'pending' with no verification fields set.
drop policy if exists "plants_insert_own_pending" on plants;
create policy "plants_insert_own_pending" on plants for insert
  with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and verified_by is null
    and verified_at is null
  );

-- Only admins can update plants (approve/reject/edit/correct coordinates)
-- — a user can never approve their own submission.
drop policy if exists "plants_admin_update" on plants;
create policy "plants_admin_update" on plants for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "plants_admin_delete" on plants;
create policy "plants_admin_delete" on plants for delete
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- STORAGE BUCKET + POLICIES
-- ============================================================

insert into storage.buckets (id, name, public)
values ('plant-images', 'plant-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'plant_images_public_read') then
    create policy "plant_images_public_read" on storage.objects for select
      using (bucket_id = 'plant-images');
  end if;

  if not exists (select 1 from pg_policies where policyname = 'plant_images_auth_upload') then
    create policy "plant_images_auth_upload" on storage.objects for insert
      with check (
        bucket_id = 'plant-images'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'plant_images_own_delete') then
    create policy "plant_images_own_delete" on storage.objects for delete
      using (
        bucket_id = 'plant-images'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
        )
      );
  end if;
end $$;

-- ============================================================
-- SAMPLE SEED DATA (safe to skip / delete — placeholder coordinates)
-- ============================================================

insert into plants (plant_name, latitude, longitude, landmark, status)
select * from (values
  ('Neem Tree', 11.01680, 76.95580, 'Near Biotechnology Block', 'approved'),
  ('Mango Tree', 11.01720, 76.95620, 'Near Hostel', 'approved'),
  ('Banyan Tree', 11.01650, 76.95540, 'Main Entrance', 'approved'),
  ('Coconut Tree', 11.01690, 76.95610, 'Near Canteen', 'approved'),
  ('Banana Tree', 11.01705, 76.95595, 'Near Library', 'approved')
) as seed(plant_name, latitude, longitude, landmark, status)
where not exists (select 1 from plants where plants.plant_name = seed.plant_name);
