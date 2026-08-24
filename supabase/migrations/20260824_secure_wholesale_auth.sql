-- Secure wholesale storefront access with Supabase Auth, RLS, and security-invoker views.
create table if not exists public.wholesale_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wholesale_accounts enable row level security;

revoke all on table public.wholesale_accounts from anon, authenticated;
grant select on table public.wholesale_accounts to authenticated;

drop policy if exists "Wholesale customers can read own account" on public.wholesale_accounts;
create policy "Wholesale customers can read own account"
on public.wholesale_accounts
for select
to authenticated
using ((select auth.uid()) = user_id);

alter policy "Public can view active products"
on public.products
to anon
using (active = true);

drop policy if exists "Approved wholesale customers can view active products" on public.products;
create policy "Approved wholesale customers can view active products"
on public.products
for select
to authenticated
using (
  active = true
  and exists (
    select 1 from public.wholesale_accounts wa
    where wa.user_id = (select auth.uid()) and wa.active = true
  )
);

revoke select, insert, update, delete, truncate, references, trigger
on table public.products from anon;
grant select (
  item_code, barcode, name, brand, category, description,
  retail, stock, image_url, active
) on table public.products to anon;

create or replace view public.retail_storefront_products
with (security_invoker = true)
as
select
  item_code, barcode, name, brand, category, description,
  null::numeric as wholesale,
  retail, stock, image_url, active
from public.products
where active = true;

create or replace view public.wholesale_storefront_products
with (security_invoker = true)
as
select
  item_code, barcode, name, brand, category, description,
  wholesale, retail, stock, image_url, active
from public.products
where active = true;

revoke all on table public.retail_storefront_products from public;
revoke all on table public.wholesale_storefront_products from public;
grant select on table public.retail_storefront_products to anon, authenticated;
grant select on table public.wholesale_storefront_products to authenticated;

create or replace function public.is_wholesale_customer()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.wholesale_accounts wa
    where wa.user_id = (select auth.uid()) and wa.active = true
  );
$$;

revoke all on function public.is_wholesale_customer() from public, anon;
grant execute on function public.is_wholesale_customer() to authenticated;

drop function if exists public.get_storefront_products();
