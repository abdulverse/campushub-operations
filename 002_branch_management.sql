-- CampusHub branch management
-- Allow only organisation-wide administrators to create or edit branches.

begin;

grant insert (organization_id, name, code, address, active)
  on public.branches to authenticated;
grant update (name, code, address, active)
  on public.branches to authenticated;

drop policy if exists branches_insert_for_group_admin on public.branches;
create policy branches_insert_for_group_admin on public.branches
  for insert to authenticated
  with check (public.has_org_capability(organization_id, '*'));

drop policy if exists branches_update_for_group_admin on public.branches;
create policy branches_update_for_group_admin on public.branches
  for update to authenticated
  using (public.has_org_capability(organization_id, '*'))
  with check (public.has_org_capability(organization_id, '*'));

commit;
