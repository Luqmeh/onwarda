-- Private tenant-aware storage. Files are never public.
-- Object keys must start with organizations/{organization_id}/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('organization-assets', 'organization-assets', false, 10485760, null),
  ('property-media', 'property-media', false, 52428800, null),
  ('guest-documents', 'guest-documents', false, 20971520, null)
on conflict (id) do update
  set public = excluded.public;

create or replace function public.storage_object_organization_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  parts text[];
begin
  parts := string_to_array(object_name, '/');

  if array_length(parts, 1) is null or array_length(parts, 1) < 2 then
    return null;
  end if;

  if parts[1] <> 'organizations' then
    return null;
  end if;

  begin
    return parts[2]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

revoke all on function public.storage_object_organization_id(text) from public;
grant execute on function public.storage_object_organization_id(text) to authenticated;

drop policy if exists tenant_select_storage_objects on storage.objects;
drop policy if exists tenant_insert_storage_objects on storage.objects;
drop policy if exists tenant_update_storage_objects on storage.objects;
drop policy if exists tenant_delete_storage_objects on storage.objects;

create policy tenant_select_storage_objects
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('organization-assets', 'property-media', 'guest-documents')
    and public.storage_object_organization_id(name) in (
      select public.current_user_organization_ids()
    )
  );

create policy tenant_insert_storage_objects
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('organization-assets', 'property-media', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );

create policy tenant_update_storage_objects
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('organization-assets', 'property-media', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  )
  with check (
    bucket_id in ('organization-assets', 'property-media', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );

create policy tenant_delete_storage_objects
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('organization-assets', 'property-media', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin']
    )
  );
