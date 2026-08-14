-- ============================================================
-- CampusFlora — Supabase SQL Schema (v3: submission/plants split)
-- Run in Supabase SQL Editor. Safe to re-run and safe to run on top of
-- either the very first schema (single `plants` table with a `status`
-- column) or the previous "simplified" schema — every step is guarded.
--
-- ARCHITECTURE
--   profiles           users/admins
--   plant_submissions  every user submission — pending/approved/rejected,
--                      kept forever as an audit trail
--   plants             ONLY approved, public records. Public search, map
--                      and nearby-plant queries read ONLY this table.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- PROFILES
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

-- ============================================================
-- PLANT_SUBMISSIONS — every user submission, kept permanently
-- ============================================================

create table if not exists plant_submissions (
  id                 uuid primary key default uuid_generate_v4(),
  plant_name         text not null check (length(trim(plant_name)) between 1 and 100),
  photo_url          text,
  latitude           double precision not null check (latitude between -90 and 90),
  longitude          double precision not null check (longitude between -180 and 180),
  location_accuracy  double precision check (location_accuracy is null or location_accuracy > 0),
  location_source    text not null default 'legacy' check (location_source in ('gps', 'map', 'admin_corrected', 'legacy')),
  landmark           text,
  submitted_by       uuid references profiles(id) on delete set null,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by        uuid references profiles(id) on delete set null,
  reviewed_at        timestamptz,
  rejection_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- PLANTS — the public, verified table. No `status` column: every row
-- here is, by definition, public.
-- ============================================================

create table if not exists plants (
  id                    uuid primary key default uuid_generate_v4(),
  plant_name            text not null,
  photo_url             text,
  latitude              double precision not null check (latitude between -90 and 90),
  longitude             double precision not null check (longitude between -180 and 180),
  location_accuracy     double precision check (location_accuracy is null or location_accuracy > 0),
  location_source       text check (location_source in ('gps', 'map', 'admin_corrected', 'legacy')),
  landmark              text,
  submitted_by          uuid references profiles(id) on delete set null,
  approved_by           uuid references profiles(id) on delete set null,
  approved_at           timestamptz,
  source_submission_id  uuid references plant_submissions(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Add any new columns that might be missing on a `plants` table created
-- by an older version of this project — must happen *before* the
-- migration block below, since that block writes into these columns.
alter table plants add column if not exists location_accuracy double precision;
alter table plants add column if not exists location_source text;
alter table plants add column if not exists approved_by uuid references profiles(id) on delete set null;
alter table plants add column if not exists approved_at timestamptz;
alter table plants add column if not exists source_submission_id uuid references plant_submissions(id) on delete set null;

-- ------------------------------------------------------------
-- MIGRATION: fold an older single-table (`plants` with a `status`
-- column) model into the new split model. Runs exactly once — once the
-- `status` column is gone from `plants`, this whole block is skipped on
-- every future run.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'status') then

    -- Bring older column names in line first, so the copy below can
    -- assume plant_name/photo_url exist under those names.
    if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'common_name')
       and not exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'plant_name') then
      alter table plants rename column common_name to plant_name;
    end if;
    if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'image_url')
       and not exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'photo_url') then
      alter table plants rename column image_url to photo_url;
    end if;

    -- Every pending/rejected row moves to plant_submissions (never lost).
    insert into plant_submissions (
      plant_name, photo_url, latitude, longitude, landmark, submitted_by,
      status, reviewed_by, reviewed_at, location_source, created_at, updated_at
    )
    select
      plant_name, photo_url, latitude, longitude, landmark, submitted_by,
      status,
      case when status = 'rejected' then submitted_by end, -- best-effort; old schema had no separate reviewer for rejections
      case when status in ('approved', 'verified', 'rejected') then updated_at end,
      'legacy',
      created_at, updated_at
    from plants
    where status not in ('approved', 'verified');

    -- Approved rows stay as `plants` — but strip pending/rejected ones
    -- and drop the columns that no longer apply to a "public only" table.
    delete from plants where status not in ('approved', 'verified');

    alter table plants drop column if exists status;
    alter table plants drop column if exists scientific_name;
    alter table plants drop column if exists local_name;
    alter table plants drop column if exists plant_type;
    alter table plants drop column if exists description;
    alter table plants drop column if exists campus_zone;
    alter table plants drop column if exists points_awarded;

    -- verified_by/verified_at -> approved_by/approved_at
    if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'verified_by') then
      update plants set approved_by = verified_by where approved_by is null;
      alter table plants drop column verified_by;
    end if;
    if exists (select 1 from information_schema.columns where table_name = 'plants' and column_name = 'verified_at') then
      update plants set approved_at = verified_at where approved_at is null;
      alter table plants drop column verified_at;
    end if;

    update plants set location_source = 'legacy' where location_source is null;
  end if;
end $$;

-- (Redundant column adds removed — handled above, before the migration
-- block, since that block needs them to already exist.)

-- Auto-update updated_at
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

drop trigger if exists plant_submissions_updated_at on plant_submissions;
create trigger plant_submissions_updated_at
  before update on plant_submissions
  for each row execute function update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists plants_name_trgm_idx on plants using gin (plant_name gin_trgm_ops);
create index if not exists plants_coords_idx on plants(latitude, longitude);
create index if not exists plants_created_at_idx on plants(created_at desc);
create index if not exists plants_submitted_by_idx on plants(submitted_by);
create index if not exists plants_source_submission_idx on plants(source_submission_id);

create index if not exists plant_submissions_status_idx on plant_submissions(status);
create index if not exists plant_submissions_submitted_by_idx on plant_submissions(submitted_by);
create index if not exists plant_submissions_created_at_idx on plant_submissions(created_at desc);

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
-- POINTS — awarded ONLY by triggers, never by a client-callable RPC.
--   +5   when a submission is created (always status='pending' on insert)
--   +10  when a submission is approved (i.e. a row lands in `plants`)
--   +20  bonus if it's the first plant in `plants` with that name
-- Both fire on INSERT only, so they can never double-fire from an edit,
-- and the approval RPC below can only ever insert into `plants` once per
-- submission (guarded by the status check inside the function).
-- ============================================================

create or replace function award_submission_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set points = points + 5 where id = new.submitted_by;
  return new;
end;
$$;

drop trigger if exists plant_submissions_award_points on plant_submissions;
create trigger plant_submissions_award_points
  after insert on plant_submissions
  for each row execute function award_submission_points();

create or replace function award_approval_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  total integer := 10;
begin
  if (
    select count(*) from plants
    where lower(plant_name) = lower(new.plant_name) and id != new.id
  ) = 0 then
    total := total + 20;
  end if;
  update profiles set points = points + total where id = new.submitted_by;
  return new;
end;
$$;

drop trigger if exists plants_award_points on plants;
create trigger plants_award_points
  after insert on plants
  for each row execute function award_approval_points();

-- ============================================================
-- LEADERBOARD
-- ============================================================

create or replace view leaderboard as
select
  p.id,
  p.name,
  p.avatar_url,
  p.points,
  count(pl.id) as verified_count,
  rank() over (order by p.points desc) as rank
from profiles p
left join plants pl on pl.submitted_by = p.id
group by p.id, p.name, p.avatar_url, p.points
order by p.points desc;

-- ============================================================
-- DYNAMIC SEARCH — reads ONLY `plants` (the public table). No plant
-- names are hardcoded anywhere in the frontend.
-- ============================================================

create or replace function search_plant_names(q text, max_results integer default 8)
returns table (plant_name text, match_count integer) language sql stable as $$
  select plant_name, count(*)::int as match_count
  from plants
  where plant_name ilike '%' || q || '%'
  group by plant_name
  order by (lower(plant_name) = lower(q)) desc, count(*) desc, plant_name asc
  limit max_results;
$$;

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
  where lower(pl.plant_name) = lower(plant_name_query)
  order by distance_metres asc nulls last
  limit max_results;
$$;

create or replace function popular_plant_names(max_results integer default 6)
returns table (plant_name text, total integer) language sql stable as $$
  select plant_name, count(*)::int as total
  from plants
  group by plant_name
  order by total desc, plant_name asc
  limit max_results;
$$;

-- ============================================================
-- ATOMIC APPROVAL — the only way a row ever gets into `plants`.
-- SECURITY DEFINER so it can insert into `plants` despite RLS denying
-- direct inserts to non-admins, but it re-checks the caller is an admin
-- itself first — the RLS bypass is not the authorization check.
--
-- Runs as a single Postgres function body: if any RAISE EXCEPTION fires,
-- every effect inside this function (the plants insert AND the
-- plant_submissions update) is rolled back automatically as one unit —
-- that's what makes this atomic, with no partial state possible.
--
-- Optional override_* params let an admin correct the plant name or
-- location as part of approving (e.g. after moving the pin on a map)
-- without a separate round-trip.
-- ============================================================

create or replace function approve_plant_submission(
  submission_id uuid,
  override_plant_name text default null,
  override_latitude double precision default null,
  override_longitude double precision default null,
  override_landmark text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sub plant_submissions%rowtype;
  new_plant_id uuid;
  caller_role text;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is distinct from 'admin' then
    raise exception 'Only admins can approve submissions';
  end if;

  select * into sub from plant_submissions where id = submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  if sub.status <> 'pending' then
    raise exception 'Submission has already been reviewed (status: %)', sub.status;
  end if;

  insert into plants (
    plant_name, photo_url, latitude, longitude, location_accuracy, location_source,
    landmark, submitted_by, approved_by, approved_at, source_submission_id
  ) values (
    coalesce(nullif(trim(override_plant_name), ''), sub.plant_name),
    sub.photo_url,
    coalesce(override_latitude, sub.latitude),
    coalesce(override_longitude, sub.longitude),
    case when override_latitude is not null or override_longitude is not null then null else sub.location_accuracy end,
    case when override_latitude is not null or override_longitude is not null then 'admin_corrected' else sub.location_source end,
    coalesce(nullif(trim(override_landmark), ''), sub.landmark),
    sub.submitted_by,
    auth.uid(),
    now(),
    sub.id
  )
  returning id into new_plant_id;

  update plant_submissions
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = submission_id;

  return new_plant_id;
end;
$$;

-- ============================================================
-- REJECTION — no plants row is ever created.
-- ============================================================

create or replace function reject_plant_submission(
  submission_id uuid,
  reason text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  sub plant_submissions%rowtype;
  caller_role text;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is distinct from 'admin' then
    raise exception 'Only admins can reject submissions';
  end if;

  select * into sub from plant_submissions where id = submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  if sub.status <> 'pending' then
    raise exception 'Submission has already been reviewed (status: %)', sub.status;
  end if;

  update plant_submissions
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = reason
  where id = submission_id;
end;
$$;

-- Normal users must never be able to call these directly with someone
-- else's data in a way that bypasses the admin check — the functions
-- check caller role themselves, so granting EXECUTE to all authenticated
-- users is safe (a non-admin caller always hits the exception above).
grant execute on function approve_plant_submission(uuid, text, double precision, double precision, text) to authenticated;
grant execute on function reject_plant_submission(uuid, text) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table plant_submissions enable row level security;
alter table plants enable row level security;

-- PROFILES
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

-- PLANT_SUBMISSIONS — never readable/writable by anonymous users.
-- Owners can read (not edit) their own; admins can read/update/delete all.
drop policy if exists "submissions_read" on plant_submissions;
create policy "submissions_read" on plant_submissions for select
  using (
    submitted_by = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "submissions_insert_own_pending" on plant_submissions;
create policy "submissions_insert_own_pending" on plant_submissions for insert
  with check (
    auth.uid() = submitted_by
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Only admins may UPDATE a submission directly (e.g. correct a location
-- before approving, or reject with a reason). Approval itself normally
-- goes through the RPC above, which runs as the function owner and is
-- not blocked by this policy.
drop policy if exists "submissions_admin_update" on plant_submissions;
create policy "submissions_admin_update" on plant_submissions for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "submissions_admin_delete" on plant_submissions;
create policy "submissions_admin_delete" on plant_submissions for delete
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- PLANTS — the entire table is public read (every row here is, by
-- definition, approved). Direct writes are admin-only; the approval RPC
-- bypasses this as SECURITY DEFINER, which is the *only* other way in.
drop policy if exists "plants_public_read" on plants;
create policy "plants_public_read" on plants for select using (true);

drop policy if exists "plants_admin_insert" on plants;
create policy "plants_admin_insert" on plants for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

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
-- SAMPLE SEED DATA (safe to skip/delete — placeholder coordinates)
-- ============================================================

insert into plants (plant_name, latitude, longitude, landmark, location_source, approved_at)
select * from (values
  ('Neem Tree', 11.01680, 76.95580, 'Near Biotechnology Block', 'legacy', now()),
  ('Mango Tree', 11.01720, 76.95620, 'Near Hostel', 'legacy', now()),
  ('Banyan Tree', 11.01650, 76.95540, 'Main Entrance', 'legacy', now()),
  ('Coconut Tree', 11.01690, 76.95610, 'Near Canteen', 'legacy', now()),
  ('Banana Tree', 11.01705, 76.95595, 'Near Library', 'legacy', now())
) as seed(plant_name, latitude, longitude, landmark, location_source, approved_at)
where not exists (select 1 from plants where plants.plant_name = seed.plant_name);
