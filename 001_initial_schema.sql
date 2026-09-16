-- CampusHub production foundation
--
-- This migration deliberately creates empty, protected tables.  Import real
-- school data only after an organisation, branches, authenticated employees,
-- and role scopes have been configured and tested.

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
    'group_admin', 'branch_admin', 'transport_manager',
    'driver_attendant', 'grievance_officer', 'task_manager'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bus_parking_location as enum ('inside_campus', 'outside_campus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bus_status as enum ('available', 'on_route', 'in_service', 'inactive', 'breakdown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.daily_run_kind as enum ('to_school', 'to_home');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.daily_log_status as enum ('draft', 'complete', 'missing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workflow_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

-- Profiles are created automatically for every Supabase Auth user.  A profile
-- is not an employee account until it receives an active membership and scope.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete set null,
  home_branch_id uuid,
  employee_code text,
  full_name text not null,
  employment_type text not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, employee_code),
  foreign key (home_branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (id, organization_id)
);

-- A NULL branch_id represents an organisation-wide scope.  Use it only for
-- roles such as group_admin; client-side branch selectors never grant access.
create table if not exists public.member_role_scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  membership_id uuid not null,
  branch_id uuid,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (membership_id, branch_id, role),
  check (branch_id is not null or role = 'group_admin'),
  foreign key (membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete cascade,
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete cascade
);

create table if not exists public.role_permissions (
  role public.app_role not null,
  capability text not null,
  primary key (role, capability)
);

insert into public.role_permissions (role, capability) values
  ('group_admin', '*'),
  ('branch_admin', 'branch.read'), ('branch_admin', 'fleet.read'), ('branch_admin', 'fleet.write'),
  ('branch_admin', 'route.read'), ('branch_admin', 'route.write'),
  ('branch_admin', 'daily_log.read'), ('branch_admin', 'daily_log.write'),
  ('branch_admin', 'fuel.read'), ('branch_admin', 'fuel.write'),
  ('branch_admin', 'employee.read'), ('branch_admin', 'grievance.read'), ('branch_admin', 'grievance.write'),
  ('branch_admin', 'task.read'), ('branch_admin', 'task.write'),
  ('transport_manager', 'branch.read'), ('transport_manager', 'fleet.read'), ('transport_manager', 'fleet.write'),
  ('transport_manager', 'route.read'), ('transport_manager', 'route.write'),
  ('transport_manager', 'daily_log.read'), ('transport_manager', 'daily_log.write'),
  ('transport_manager', 'fuel.read'), ('transport_manager', 'fuel.write'), ('transport_manager', 'employee.read'),
  ('driver_attendant', 'branch.read'), ('driver_attendant', 'fleet.read'), ('driver_attendant', 'daily_log.read'),
  ('grievance_officer', 'branch.read'), ('grievance_officer', 'grievance.read'), ('grievance_officer', 'grievance.write'),
  ('task_manager', 'branch.read'), ('task_manager', 'task.read'), ('task_manager', 'task.write')
on conflict do nothing;

-- These functions are the database authority for tenant, role, and branch
-- checks.  They deliberately use an empty search path and fully-qualified
-- table names, per Supabase security guidance.
create or replace function public.is_active_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and profile.active
      and organization.active
  );
$$;

create or replace function public.has_branch_capability(
  p_organization_id uuid,
  p_branch_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    join public.branches branch
      on branch.id = p_branch_id
     and branch.organization_id = membership.organization_id
    join public.member_role_scopes scope
      on scope.membership_id = membership.id
     and scope.organization_id = membership.organization_id
    join public.role_permissions permission on permission.role = scope.role
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and profile.active
      and organization.active
      and branch.active
      and scope.active
      and (scope.branch_id is null or scope.branch_id = p_branch_id)
      and (permission.capability = '*' or permission.capability = p_capability)
  );
$$;

create or replace function public.has_org_capability(
  p_organization_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    join public.member_role_scopes scope
      on scope.membership_id = membership.id
     and scope.organization_id = membership.organization_id
    join public.role_permissions permission on permission.role = scope.role
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and profile.active
      and organization.active
      and scope.active
      and scope.branch_id is null
      and (permission.capability = '*' or permission.capability = p_capability)
  );
$$;

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  registration_number text not null,
  bus_code text not null,
  make_model text,
  seating_capacity integer check (seating_capacity is null or seating_capacity > 0),
  current_odometer_km numeric(12,1) not null default 0 check (current_odometer_km >= 0),
  fuel_tank_capacity_l numeric(10,1) check (fuel_tank_capacity_l is null or fuel_tank_capacity_l > 0),
  parking_location public.bus_parking_location not null default 'inside_campus',
  status public.bus_status not null default 'available',
  default_driver_employee_id uuid,
  gps_device_id text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, registration_number),
  unique (organization_id, bus_code),
  unique (id, organization_id, branch_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict,
  foreign key (default_driver_employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  route_code text not null,
  name text not null,
  planned_distance_km numeric(10,1) check (planned_distance_km is null or planned_distance_km >= 0),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, route_code),
  unique (id, organization_id, branch_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  route_id uuid not null,
  stop_sequence integer not null check (stop_sequence > 0),
  name text not null,
  expected_arrival time,
  expected_departure time,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now(),
  unique (route_id, stop_sequence),
  foreign key (route_id, organization_id, branch_id)
    references public.routes(id, organization_id, branch_id) on delete cascade
);

create table if not exists public.daily_bus_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  service_date date not null,
  bus_id uuid not null,
  route_id uuid,
  driver_employee_id uuid,
  attendant_employee_id uuid,
  parking_location_at_start public.bus_parking_location not null,
  opening_odometer_km numeric(12,1) not null check (opening_odometer_km >= 0),
  closing_odometer_km numeric(12,1) check (closing_odometer_km is null or closing_odometer_km >= opening_odometer_km),
  total_km numeric(12,1) generated always as (closing_odometer_km - opening_odometer_km) stored,
  status public.daily_log_status not null default 'draft',
  remarks text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bus_id, service_date),
  unique (id, organization_id, branch_id),
  foreign key (bus_id, organization_id, branch_id)
    references public.buses(id, organization_id, branch_id) on delete restrict,
  foreign key (route_id, organization_id, branch_id)
    references public.routes(id, organization_id, branch_id) on delete restrict,
  foreign key (driver_employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict,
  foreign key (attendant_employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create table if not exists public.daily_bus_runs (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.daily_bus_logs(id) on delete cascade,
  run_kind public.daily_run_kind not null,
  run_number smallint not null check (run_number in (1, 2)),
  departed_at time,
  arrived_at time,
  created_at timestamptz not null default now(),
  unique (log_id, run_kind, run_number)
);

create table if not exists public.fuel_vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table if not exists public.fuel_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  bus_id uuid not null,
  vendor_id uuid,
  filled_at timestamptz not null default now(),
  opening_litres numeric(10,2) check (opening_litres is null or opening_litres >= 0),
  quantity_litres numeric(10,2) not null check (quantity_litres > 0),
  rate_per_litre numeric(10,2) not null check (rate_per_litre > 0),
  total_amount numeric(12,2) generated always as (quantity_litres * rate_per_litre) stored,
  closing_litres numeric(10,2) check (closing_litres is null or closing_litres >= 0),
  odometer_km numeric(12,1) check (odometer_km is null or odometer_km >= 0),
  distance_since_last_fill_km numeric(12,1) check (distance_since_last_fill_km is null or distance_since_last_fill_km >= 0),
  km_per_litre numeric(12,2) generated always as (distance_since_last_fill_km / nullif(quantity_litres, 0)) stored,
  cost_per_km numeric(12,2) generated always as ((quantity_litres * rate_per_litre) / nullif(distance_since_last_fill_km, 0)) stored,
  invoice_number text,
  notes text,
  entered_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (bus_id, organization_id, branch_id)
    references public.buses(id, organization_id, branch_id) on delete restrict,
  foreign key (vendor_id, organization_id)
    references public.fuel_vendors(id, organization_id) on delete restrict
);

-- These two modules are intentionally lean at first.  Parent/student records,
-- attachments, and precise location data are deferred until their own privacy
-- controls and import process are ready.
create table if not exists public.grievances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  ticket_number text not null,
  parent_name text,
  parent_contact text,
  category text not null,
  priority text not null default 'normal',
  subject text not null,
  description text,
  status public.workflow_status not null default 'open',
  assignee_employee_id uuid,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, ticket_number),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict,
  foreign key (assignee_employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  title text not null,
  module text,
  priority text not null default 'normal',
  status public.workflow_status not null default 'open',
  assignee_employee_id uuid,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict,
  foreign key (assignee_employee_id, organization_id)
    references public.employees(id, organization_id) on delete restrict
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

create index if not exists membership_user_idx on public.organization_memberships(user_id) where active;
create index if not exists role_scope_membership_idx on public.member_role_scopes(membership_id, branch_id) where active;
create unique index if not exists role_scope_orgwide_unique
  on public.member_role_scopes(membership_id, role) where branch_id is null;
create index if not exists buses_org_branch_idx on public.buses(organization_id, branch_id);
create index if not exists routes_org_branch_idx on public.routes(organization_id, branch_id);
create index if not exists logs_org_branch_date_idx on public.daily_bus_logs(organization_id, branch_id, service_date desc);
create index if not exists logs_bus_date_idx on public.daily_bus_logs(bus_id, service_date desc);
create index if not exists fuel_org_branch_filled_idx on public.fuel_entries(organization_id, branch_id, filled_at desc);
create index if not exists grievances_org_branch_status_idx on public.grievances(organization_id, branch_id, status);
create index if not exists tasks_org_branch_status_idx on public.tasks(organization_id, branch_id, status);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists touch_organizations_updated_at on public.organizations;
create trigger touch_organizations_updated_at before update on public.organizations
for each row execute function public.touch_updated_at();
drop trigger if exists touch_branches_updated_at on public.branches;
create trigger touch_branches_updated_at before update on public.branches
for each row execute function public.touch_updated_at();
drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists touch_employees_updated_at on public.employees;
create trigger touch_employees_updated_at before update on public.employees
for each row execute function public.touch_updated_at();
drop trigger if exists touch_memberships_updated_at on public.organization_memberships;
create trigger touch_memberships_updated_at before update on public.organization_memberships
for each row execute function public.touch_updated_at();
drop trigger if exists touch_buses_updated_at on public.buses;
create trigger touch_buses_updated_at before update on public.buses
for each row execute function public.touch_updated_at();
drop trigger if exists touch_routes_updated_at on public.routes;
create trigger touch_routes_updated_at before update on public.routes
for each row execute function public.touch_updated_at();
drop trigger if exists touch_logs_updated_at on public.daily_bus_logs;
create trigger touch_logs_updated_at before update on public.daily_bus_logs
for each row execute function public.touch_updated_at();
drop trigger if exists touch_grievances_updated_at on public.grievances;
create trigger touch_grievances_updated_at before update on public.grievances
for each row execute function public.touch_updated_at();
drop trigger if exists touch_tasks_updated_at on public.tasks;
create trigger touch_tasks_updated_at before update on public.tasks
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill a profile for an Auth user that may have existed before this
-- migration.  A profile alone grants no application access.
insert into public.profiles (id, full_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (id) do nothing;

-- A single transaction creates or replaces a four-run daily log, validates the
-- parking rule, and updates the bus odometer.  Direct client writes to logs and
-- runs are intentionally not granted; use this RPC from the authenticated app.
create or replace function public.submit_daily_log(
  p_bus_id uuid,
  p_service_date date,
  p_route_id uuid,
  p_driver_employee_id uuid,
  p_attendant_employee_id uuid,
  p_parking_location public.bus_parking_location,
  p_opening_odometer_km numeric,
  p_closing_odometer_km numeric,
  p_school_run_1_departed_at time,
  p_school_run_1_arrived_at time,
  p_school_run_2_arrived_at time,
  p_home_run_1_departed_at time,
  p_home_run_1_arrived_at time,
  p_home_run_2_departed_at time,
  p_home_run_2_arrived_at time,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bus public.buses%rowtype;
  v_log_id uuid;
begin
  select * into v_bus
  from public.buses
  where id = p_bus_id and active
  for update;

  if not found then
    raise exception 'Bus is unavailable';
  end if;

  if not public.has_branch_capability(v_bus.organization_id, v_bus.branch_id, 'daily_log.write') then
    raise exception 'Not authorised to submit a daily log for this branch';
  end if;

  if p_opening_odometer_km <> v_bus.current_odometer_km then
    raise exception 'Opening odometer does not match the current bus odometer';
  end if;

  if p_closing_odometer_km < p_opening_odometer_km then
    raise exception 'Closing odometer cannot be less than opening odometer';
  end if;

  if p_parking_location = 'inside_campus' and p_school_run_1_departed_at is null then
    raise exception 'Inside-campus parking requires the first school run out time';
  end if;

  if p_parking_location = 'outside_campus' and p_school_run_1_arrived_at is null then
    raise exception 'Outside-campus parking requires the first school run in time';
  end if;

  if p_school_run_2_arrived_at is null
     or p_home_run_1_departed_at is null or p_home_run_1_arrived_at is null
     or p_home_run_2_departed_at is null or p_home_run_2_arrived_at is null then
    raise exception 'All remaining school and home trip times are required';
  end if;

  if p_school_run_2_arrived_at <= coalesce(p_school_run_1_departed_at, p_school_run_1_arrived_at)
     or p_home_run_1_departed_at >= p_home_run_1_arrived_at
     or p_home_run_1_arrived_at >= p_home_run_2_departed_at
     or p_home_run_2_departed_at >= p_home_run_2_arrived_at then
    raise exception 'Trip times must be in chronological order';
  end if;

  if p_route_id is not null and not exists (
    select 1 from public.routes
    where id = p_route_id
      and organization_id = v_bus.organization_id
      and branch_id = v_bus.branch_id
      and active
  ) then
    raise exception 'Route does not belong to this bus branch';
  end if;

  if p_driver_employee_id is not null and not exists (
    select 1 from public.employees
    where id = p_driver_employee_id
      and organization_id = v_bus.organization_id
      and active
      and (home_branch_id is null or home_branch_id = v_bus.branch_id)
  ) then
    raise exception 'Driver is not active for this branch';
  end if;

  if p_attendant_employee_id is not null and not exists (
    select 1 from public.employees
    where id = p_attendant_employee_id
      and organization_id = v_bus.organization_id
      and active
      and (home_branch_id is null or home_branch_id = v_bus.branch_id)
  ) then
    raise exception 'Attendant is not active for this branch';
  end if;

  insert into public.daily_bus_logs (
    organization_id, branch_id, service_date, bus_id, route_id,
    driver_employee_id, attendant_employee_id, parking_location_at_start,
    opening_odometer_km, closing_odometer_km, status, remarks, created_by
  ) values (
    v_bus.organization_id, v_bus.branch_id, p_service_date, p_bus_id, p_route_id,
    p_driver_employee_id, p_attendant_employee_id, p_parking_location,
    p_opening_odometer_km, p_closing_odometer_km, 'complete', p_remarks, auth.uid()
  )
  on conflict (bus_id, service_date) do update set
    route_id = excluded.route_id,
    driver_employee_id = excluded.driver_employee_id,
    attendant_employee_id = excluded.attendant_employee_id,
    parking_location_at_start = excluded.parking_location_at_start,
    opening_odometer_km = excluded.opening_odometer_km,
    closing_odometer_km = excluded.closing_odometer_km,
    status = excluded.status,
    remarks = excluded.remarks,
    created_by = excluded.created_by
  returning id into v_log_id;

  delete from public.daily_bus_runs where log_id = v_log_id;

  insert into public.daily_bus_runs (log_id, run_kind, run_number, departed_at, arrived_at) values
    (v_log_id, 'to_school', 1, p_school_run_1_departed_at, p_school_run_1_arrived_at),
    (v_log_id, 'to_school', 2, null, p_school_run_2_arrived_at),
    (v_log_id, 'to_home', 1, p_home_run_1_departed_at, p_home_run_1_arrived_at),
    (v_log_id, 'to_home', 2, p_home_run_2_departed_at, p_home_run_2_arrived_at);

  update public.buses
  set current_odometer_km = p_closing_odometer_km,
      parking_location = p_parking_location
  where id = p_bus_id;

  insert into public.audit_events (
    organization_id, branch_id, entity_type, entity_id, action, actor_user_id, detail
  ) values (
    v_bus.organization_id, v_bus.branch_id, 'daily_bus_log', v_log_id, 'submitted', auth.uid(),
    jsonb_build_object('bus_id', p_bus_id, 'service_date', p_service_date)
  );

  return v_log_id;
end;
$$;

-- Make the public schema callable only by signed-in users, then explicitly
-- grant the smallest table/function surface the app needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to authenticated;

grant select on public.organizations, public.branches, public.profiles,
  public.organization_memberships, public.member_role_scopes to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.employees to authenticated;
grant select on public.buses, public.routes, public.route_stops to authenticated;
grant insert (
  organization_id, branch_id, registration_number, bus_code, make_model,
  seating_capacity, current_odometer_km, fuel_tank_capacity_l, parking_location,
  status, default_driver_employee_id, gps_device_id, active
) on public.buses to authenticated;
grant update (
  registration_number, bus_code, make_model, seating_capacity,
  fuel_tank_capacity_l, parking_location, status, default_driver_employee_id,
  gps_device_id, active
) on public.buses to authenticated;
grant insert (
  organization_id, branch_id, route_code, name, planned_distance_km, active
) on public.routes to authenticated;
grant update (route_code, name, planned_distance_km, active)
  on public.routes to authenticated;
grant insert, update on public.route_stops to authenticated;
grant select on public.daily_bus_logs, public.daily_bus_runs to authenticated;
grant select, insert, update on public.fuel_vendors to authenticated;
grant select on public.fuel_entries to authenticated;
grant insert (
  organization_id, branch_id, bus_id, vendor_id, filled_at, opening_litres,
  quantity_litres, rate_per_litre, closing_litres, odometer_km,
  distance_since_last_fill_km, invoice_number, notes
) on public.fuel_entries to authenticated;
grant update (
  vendor_id, filled_at, opening_litres, quantity_litres, rate_per_litre,
  closing_litres, odometer_km, distance_since_last_fill_km, invoice_number, notes
) on public.fuel_entries to authenticated;
grant select on public.grievances, public.tasks to authenticated;
grant insert (
  organization_id, branch_id, ticket_number, parent_name, parent_contact,
  category, priority, subject, description, status, assignee_employee_id, due_at,
  resolved_at
) on public.grievances to authenticated;
grant update (
  ticket_number, parent_name, parent_contact, category, priority, subject,
  description, status, assignee_employee_id, due_at, resolved_at
) on public.grievances to authenticated;
grant insert (
  organization_id, branch_id, title, module, priority, status,
  assignee_employee_id, due_at, completed_at
) on public.tasks to authenticated;
grant update (
  title, module, priority, status, assignee_employee_id, due_at, completed_at
) on public.tasks to authenticated;
grant select on public.audit_events to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.has_branch_capability(uuid, uuid, text) to authenticated;
grant execute on function public.has_org_capability(uuid, text) to authenticated;
grant execute on function public.submit_daily_log(
  uuid, date, uuid, uuid, uuid, public.bus_parking_location, numeric, numeric,
  time, time, time, time, time, time, time, text
) to authenticated;

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.member_role_scopes enable row level security;
alter table public.role_permissions enable row level security;
alter table public.buses enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.daily_bus_logs enable row level security;
alter table public.daily_bus_runs enable row level security;
alter table public.fuel_vendors enable row level security;
alter table public.fuel_entries enable row level security;
alter table public.grievances enable row level security;
alter table public.tasks enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_read_for_members on public.organizations for select to authenticated
  using (public.is_active_member(id));
create policy branches_read_in_scope on public.branches for select to authenticated
  using (public.has_branch_capability(organization_id, id, 'branch.read'));

create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy memberships_read_self on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()) and active and public.is_active_member(organization_id));
create policy role_scopes_read_self on public.member_role_scopes for select to authenticated
  using (exists (
    select 1 from public.organization_memberships membership
    where membership.id = member_role_scopes.membership_id
      and membership.user_id = (select auth.uid())
      and membership.active
  ) and member_role_scopes.active and public.is_active_member(organization_id));

create policy employees_read_in_scope on public.employees for select to authenticated
  using (
    case when home_branch_id is null
      then public.has_org_capability(organization_id, 'employee.read')
      else public.has_branch_capability(organization_id, home_branch_id, 'employee.read')
    end
  );

create policy buses_read_in_scope on public.buses for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'fleet.read'));
create policy buses_insert_in_scope on public.buses for insert to authenticated
  with check (
    public.has_branch_capability(organization_id, branch_id, 'fleet.write')
    and created_by = (select auth.uid())
  );
create policy buses_update_in_scope on public.buses for update to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'fleet.write'))
  with check (public.has_branch_capability(organization_id, branch_id, 'fleet.write'));

create policy routes_read_in_scope on public.routes for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'route.read'));
create policy routes_insert_in_scope on public.routes for insert to authenticated
  with check (
    public.has_branch_capability(organization_id, branch_id, 'route.write')
    and created_by = (select auth.uid())
  );
create policy routes_update_in_scope on public.routes for update to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'route.write'))
  with check (public.has_branch_capability(organization_id, branch_id, 'route.write'));
create policy route_stops_read_in_scope on public.route_stops for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'route.read'));
create policy route_stops_insert_in_scope on public.route_stops for insert to authenticated
  with check (public.has_branch_capability(organization_id, branch_id, 'route.write'));
create policy route_stops_update_in_scope on public.route_stops for update to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'route.write'))
  with check (public.has_branch_capability(organization_id, branch_id, 'route.write'));

create policy logs_read_in_scope on public.daily_bus_logs for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'daily_log.read'));
create policy runs_read_in_scope on public.daily_bus_runs for select to authenticated
  using (exists (
    select 1 from public.daily_bus_logs log
    where log.id = daily_bus_runs.log_id
      and public.has_branch_capability(log.organization_id, log.branch_id, 'daily_log.read')
  ));

create policy vendors_read_for_active_member on public.fuel_vendors for select to authenticated
  using (public.is_active_member(organization_id));
create policy vendors_write_for_org_admin on public.fuel_vendors for insert to authenticated
  with check (public.has_org_capability(organization_id, 'fuel.write'));
create policy vendors_update_for_org_admin on public.fuel_vendors for update to authenticated
  using (public.has_org_capability(organization_id, 'fuel.write'))
  with check (public.has_org_capability(organization_id, 'fuel.write'));
create policy fuel_read_in_scope on public.fuel_entries for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'fuel.read'));
create policy fuel_insert_in_scope on public.fuel_entries for insert to authenticated
  with check (
    public.has_branch_capability(organization_id, branch_id, 'fuel.write')
    and entered_by = (select auth.uid())
  );
create policy fuel_update_in_scope on public.fuel_entries for update to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'fuel.write'))
  with check (public.has_branch_capability(organization_id, branch_id, 'fuel.write'));

create policy grievances_read_in_scope on public.grievances for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'grievance.read'));
create policy grievances_insert_in_scope on public.grievances for insert to authenticated
  with check (
    public.has_branch_capability(organization_id, branch_id, 'grievance.write')
    and created_by = (select auth.uid())
  );
create policy grievances_update_in_scope on public.grievances for update to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'grievance.write'))
  with check (public.has_branch_capability(organization_id, branch_id, 'grievance.write'));

create policy tasks_read_in_scope on public.tasks for select to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'task.read'));
create policy tasks_insert_in_scope on public.tasks for insert to authenticated
  with check (
    public.has_branch_capability(organization_id, branch_id, 'task.write')
    and created_by = (select auth.uid())
  );
create policy tasks_update_in_scope on public.tasks for update to authenticated
  using (public.has_branch_capability(organization_id, branch_id, 'task.write'))
  with check (public.has_branch_capability(organization_id, branch_id, 'task.write'));

create policy audit_read_for_org_admin on public.audit_events for select to authenticated
  using (public.has_org_capability(organization_id, '*'));

commit;
