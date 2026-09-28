-- ============================================================
-- MindFlow schema
-- Run against your Supabase project (SQL editor or `supabase db push`).
-- Requires the `auth` schema from Supabase GoTrue.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type workspace_type as enum ('personal', 'work');
create type member_role as enum ('owner', 'partner', 'editor', 'viewer');
create type node_kind as enum ('cluster', 'node');

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type workspace_type not null default 'personal',
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  title text not null default 'Untitled Map',
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps (id) on delete cascade,
  parent_id uuid references nodes (id) on delete set null,
  kind node_kind not null default 'node',
  label text not null default '',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  color text,
  inbox boolean not null default false,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps (id) on delete cascade,
  source uuid not null references nodes (id) on delete cascade,
  target uuid not null references nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (map_id, source, target)
);

-- API tokens power the /api/quick-capture endpoint.
-- Only a SHA-256 hash of the token is stored.
create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  workspace_id uuid references workspaces (id) on delete cascade,
  name text not null default 'default',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_maps_workspace on maps (workspace_id);
create index if not exists idx_nodes_map on nodes (map_id);
create index if not exists idx_edges_map on edges (map_id);
create index if not exists idx_members_user on workspace_members (user_id);
create index if not exists idx_tokens_user on api_tokens (user_id);
create index if not exists idx_tokens_hash on api_tokens (token_hash);

-- ------------------------------------------------------------
-- Helper functions (security definer so RLS does not recurse)
-- ------------------------------------------------------------
create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

create or replace function current_member_role(ws_id uuid)
returns member_role
language sql
security definer
set search_path = public
stable
as $$
  select role from workspace_members
  where workspace_id = ws_id and user_id = auth.uid()
  limit 1;
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table maps enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table api_tokens enable row level security;

-- profiles
create policy profiles_select_self on profiles
  for select using (id = auth.uid());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());
create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

-- workspaces
create policy workspaces_select_member on workspaces
  for select using (is_workspace_member(id));
create policy workspaces_insert_owner on workspaces
  for insert with check (created_by = auth.uid());
create policy workspaces_update_member on workspaces
  for update using (
    is_workspace_member(id) and current_member_role(id) in ('owner', 'partner')
  );
create policy workspaces_delete_owner on workspaces
  for delete using (current_member_role(id) = 'owner');

-- workspace_members
create policy members_select on workspace_members
  for select using (user_id = auth.uid() or is_workspace_member(workspace_id));
create policy members_insert_owner on workspace_members
  for insert with check (current_member_role(workspace_id) = 'owner');
create policy members_delete_owner on workspace_members
  for delete using (current_member_role(workspace_id) = 'owner');

-- maps
create policy maps_select_member on maps
  for select using (is_workspace_member(workspace_id));
create policy maps_insert_member on maps
  for insert with check (is_workspace_member(workspace_id));
create policy maps_update_member on maps
  for update using (is_workspace_member(workspace_id));
create policy maps_delete_member on maps
  for delete using (is_workspace_member(workspace_id));

-- nodes
create policy nodes_select_member on nodes
  for select using (
    exists (
      select 1 from maps m
      where m.id = nodes.map_id and is_workspace_member(m.workspace_id)
    )
  );
create policy nodes_insert_member on nodes
  for insert with check (
    exists (
      select 1 from maps m
      where m.id = nodes.map_id and is_workspace_member(m.workspace_id)
    )
  );
create policy nodes_update_member on nodes
  for update using (
    exists (
      select 1 from maps m
      where m.id = nodes.map_id and is_workspace_member(m.workspace_id)
    )
  );
create policy nodes_delete_member on nodes
  for delete using (
    exists (
      select 1 from maps m
      where m.id = nodes.map_id and is_workspace_member(m.workspace_id)
    )
  );

-- edges
create policy edges_select_member on edges
  for select using (
    exists (
      select 1 from maps m
      where m.id = edges.map_id and is_workspace_member(m.workspace_id)
    )
  );
create policy edges_insert_member on edges
  for insert with check (
    exists (
      select 1 from maps m
      where m.id = edges.map_id and is_workspace_member(m.workspace_id)
    )
  );
create policy edges_update_member on edges
  for update using (
    exists (
      select 1 from maps m
      where m.id = edges.map_id and is_workspace_member(m.workspace_id)
    )
  );
create policy edges_delete_member on edges
  for delete using (
    exists (
      select 1 from maps m
      where m.id = edges.map_id and is_workspace_member(m.workspace_id)
    )
  );

-- api_tokens
create policy tokens_select_owner on api_tokens
  for select using (user_id = auth.uid());
create policy tokens_insert_owner on api_tokens
  for insert with check (user_id = auth.uid());
create policy tokens_update_owner on api_tokens
  for update using (user_id = auth.uid());
create policy tokens_delete_owner on api_tokens
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists on_workspace_created on workspaces;
create trigger on_workspace_created
  after insert on workspaces
  for each row execute function add_owner_membership();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nodes_set_updated_at on nodes;
create trigger nodes_set_updated_at
  before update on nodes
  for each row execute function set_updated_at();

drop trigger if exists maps_set_updated_at on maps;
create trigger maps_set_updated_at
  before update on maps
  for each row execute function set_updated_at();
