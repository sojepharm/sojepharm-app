-- Secure wholesale storefront access with Supabase Auth and RLS.
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

create or replace function public.is_wholesale_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wholesale_accounts wa
    where wa.user_id = (select auth.uid())
      and wa.active = true
  );
$$;

revoke all on function public.is_wholesale_customer() from public, anon;
grant execute on function public.is_wholesale_customer() to authenticated;

create or replace function public.get_storefront_products()
returns table (
  item_code text,
  barcode text,
  name text,
  brand text,
  category text,
  description text,
  wholesale numeric,
  retail numeric,
  stock integer,
  image_url text,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.item_code, p.barcode, p.name, p.brand, p.category, p.description,
    case
      when exists (
        select 1 from public.wholesale_accounts wa
        where wa.user_id = (select auth.uid()) and wa.active = true
      ) then p.wholesale
      else null
    end as wholesale,
    p.retail, p.stock, p.image_url, p.active
  from public.products p
  where p.active = true
  order by p.name;
$$;

revoke all on function public.get_storefront_products() from public;
grant execute on function public.get_storefront_products() to anon, authenticated;
