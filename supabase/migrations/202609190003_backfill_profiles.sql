insert into public.profiles (id, full_name)
select users.id, coalesce(users.raw_user_meta_data ->> 'full_name', split_part(users.email, '@', 1))
from auth.users as users
where not exists (select 1 from public.profiles where profiles.id = users.id);