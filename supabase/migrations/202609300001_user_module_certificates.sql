create unique index if not exists certificates_user_module_unique
  on public.certificates (user_id, module_id)
  where module_id is not null;