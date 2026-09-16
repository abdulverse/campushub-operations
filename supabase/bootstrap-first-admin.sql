-- CampusHub first administrator bootstrap
--
-- Run this only AFTER 001_initial_schema.sql has completed and AFTER you have
-- created/invited the first CampusHub login in Supabase Authentication.
-- Replace only the three values below. Do not add passwords or service keys.

do $$
declare
  v_owner_email text := 'OWNER_EMAIL_HERE';
  v_organization_name text := 'SCHOOL_GROUP_NAME_HERE';
  v_branch_names text[] := array['FIRST_BRANCH_NAME_HERE'];
  v_user_id uuid;
  v_organization_id uuid;
  v_membership_id uuid;
  v_branch_name text;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No Supabase Auth user exists for %. Invite or create the owner login first.', v_owner_email;
  end if;

  -- Covers users invited before the database trigger was installed.
  insert into public.profiles (id, full_name)
  values (v_user_id, split_part(v_owner_email, '@', 1))
  on conflict (id) do nothing;

  insert into public.organizations (name, active)
  values (v_organization_name, true)
  on conflict (name) do update set active = true
  returning id into v_organization_id;

  foreach v_branch_name in array v_branch_names loop
    insert into public.branches (organization_id, name, active)
    values (v_organization_id, v_branch_name, true)
    on conflict (organization_id, name) do update set active = true;
  end loop;

  insert into public.organization_memberships (organization_id, user_id, active)
  values (v_organization_id, v_user_id, true)
  on conflict (organization_id, user_id) do update set active = true
  returning id into v_membership_id;

  -- A NULL branch is intentionally allowed only for group_admin: it gives the
  -- owner visibility across every branch in this organisation.
  if exists (
    select 1
    from public.member_role_scopes
    where membership_id = v_membership_id
      and branch_id is null
      and role = 'group_admin'
  ) then
    update public.member_role_scopes
    set active = true
    where membership_id = v_membership_id
      and branch_id is null
      and role = 'group_admin';
  else
    insert into public.member_role_scopes (
      organization_id, membership_id, branch_id, role, active
    ) values (
      v_organization_id, v_membership_id, null, 'group_admin', true
    );
  end if;

  raise notice 'CampusHub administrator provisioned for % in %', v_owner_email, v_organization_name;
end;
$$;
