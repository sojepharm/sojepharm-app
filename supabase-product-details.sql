-- Run this once in Supabase SQL Editor.
-- Adds an optional ingredients field for products such as pet food.

alter table public.products
add column if not exists ingredients text;
