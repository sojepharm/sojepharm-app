-- Pet Unleash: allow only the shop owner's authenticated account to manage products and images.
-- This is safe to run once. Change the email below only if the owner uses a different email.

drop policy if exists "Pet Unleash admin can read all products" on public.products;
drop policy if exists "Pet Unleash admin can add products" on public.products;
drop policy if exists "Pet Unleash admin can edit products" on public.products;
drop policy if exists "Pet Unleash admin can delete products" on public.products;
drop policy if exists "Pet Unleash admin can upload product images" on storage.objects;
drop policy if exists "Pet Unleash admin can update product images" on storage.objects;
drop policy if exists "Pet Unleash admin can delete product images" on storage.objects;

create policy "Pet Unleash admin can read all products"
on public.products for select to authenticated
using ((auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');

create policy "Pet Unleash admin can add products"
on public.products for insert to authenticated
with check ((auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');

create policy "Pet Unleash admin can edit products"
on public.products for update to authenticated
using ((auth.jwt() ->> 'email') = 'danielchaaly@gmail.com')
with check ((auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');

create policy "Pet Unleash admin can delete products"
on public.products for delete to authenticated
using ((auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');

create policy "Pet Unleash admin can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');

create policy "Pet Unleash admin can update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (auth.jwt() ->> 'email') = 'danielchaaly@gmail.com')
with check (bucket_id = 'product-images' and (auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');

create policy "Pet Unleash admin can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (auth.jwt() ->> 'email') = 'danielchaaly@gmail.com');
