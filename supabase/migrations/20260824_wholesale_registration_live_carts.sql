-- Wholesale self-registration with manual WhatsApp verification and admin-visible live carts.
create table if not exists public.wholesale_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  customer_name text not null,
  shop_name text not null,
  phone text not null unique,
  address text,
  verification_code text not null,
  request_ip_hash text,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 10),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wholesale_registrations enable row level security;
revoke all on table public.wholesale_registrations from anon, authenticated;
grant select, update, delete on table public.wholesale_registrations to authenticated;
create policy "Admin manages wholesale registrations" on public.wholesale_registrations
for all to authenticated
using (((select auth.jwt()) ->> 'email') = 'danielchaaly@gmail.com')
with check (((select auth.jwt()) ->> 'email') = 'danielchaaly@gmail.com');

create table if not exists public.live_carts (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_type text not null default 'retail' check (customer_type in ('retail','wholesale')),
  status text not null default 'draft' check (status in ('draft','submitted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.live_carts enable row level security;
revoke all on table public.live_carts from anon, authenticated;
grant select, update, delete on table public.live_carts to authenticated;
create policy "Admin manages live carts" on public.live_carts
for all to authenticated
using (((select auth.jwt()) ->> 'email') = 'danielchaaly@gmail.com')
with check (((select auth.jwt()) ->> 'email') = 'danielchaaly@gmail.com');

create table if not exists public.live_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.live_carts(id) on delete cascade,
  item_code text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 999),
  unit_price numeric not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (cart_id, item_code)
);
alter table public.live_cart_items enable row level security;
revoke all on table public.live_cart_items from anon, authenticated;
grant select, update, delete on table public.live_cart_items to authenticated;
create policy "Admin manages live cart items" on public.live_cart_items
for all to authenticated
using (
  ((select auth.jwt()) ->> 'email') = 'danielchaaly@gmail.com'
  and exists (select 1 from public.live_carts c where c.id = cart_id)
)
with check (
  ((select auth.jwt()) ->> 'email') = 'danielchaaly@gmail.com'
  and exists (select 1 from public.live_carts c where c.id = cart_id)
);

create index if not exists live_cart_items_cart_id_idx on public.live_cart_items(cart_id);
create index if not exists live_carts_updated_at_idx on public.live_carts(updated_at desc);
create index if not exists live_carts_user_id_idx on public.live_carts(user_id);
create index if not exists wholesale_registrations_created_at_idx on public.wholesale_registrations(created_at desc);
