-- Defense in depth: authenticated gets only the table rights RLS policies need.
-- Guest token resolution must not be callable by authenticated or anon users.

revoke all on table public.profiles from authenticated;
revoke all on table public.platform_admins from authenticated;
revoke all on table public.organizations from authenticated;
revoke all on table public.organization_users from authenticated;
revoke all on table public.properties from authenticated;
revoke all on table public.guests from authenticated;
revoke all on table public.reservations from authenticated;
revoke all on table public.guest_portal_tokens from authenticated;
revoke all on table public.issues from authenticated;
revoke all on table public.property_knowledge from authenticated;
revoke all on table public.events from authenticated;
revoke all on table public.audit_logs from authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.platform_admins to authenticated;
grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_users to authenticated;
grant select, insert, update, delete on table public.properties to authenticated;
grant select, insert, update, delete on table public.guests to authenticated;
grant select, insert, update, delete on table public.reservations to authenticated;
grant select, insert, update, delete on table public.guest_portal_tokens to authenticated;
grant select, insert, update, delete on table public.issues to authenticated;
grant select, insert, update, delete on table public.property_knowledge to authenticated;
grant select, insert on table public.events to authenticated;
grant select on table public.audit_logs to authenticated;

revoke all on function public.resolve_guest_portal_token(text) from public;
revoke all on function public.resolve_guest_portal_token(text) from anon;
revoke all on function public.resolve_guest_portal_token(text) from authenticated;
grant execute on function public.resolve_guest_portal_token(text) to service_role;
