# CampusHub live setup

The first migration creates protected empty tables and row-level access rules.
It does not import student, parent, employee, or vehicle data.

1. In Supabase SQL Editor, run `migrations/001_initial_schema.sql`.
2. In Supabase Authentication, invite or create the first CampusHub owner login.
   Use a real school-controlled email address and keep sign-up invite-only.
3. In `bootstrap-first-admin.sql`, replace the three placeholder values, then
   run it in SQL Editor. This assigns that account the cross-branch
   `group_admin` role for the named organisation.
4. Sign in with the owner account and test the empty application before
   importing any original school data.

Never add a database password or `service_role` key to the browser, GitHub, or
this repository. The public browser key is only added after the RLS checks pass.
