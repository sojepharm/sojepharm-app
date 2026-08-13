PET UNLEASH — Supabase version

This folder is ready to deploy to Netlify or GitHub.

Before publishing:
1. Open supabase-config.js in a text editor.
2. In Supabase, click Connect > App Frameworks > JavaScript.
3. Copy ONLY the anon public key and replace PASTE_YOUR_SUPABASE_ANON_KEY_HERE.
4. Never use or publish the service_role key.

What is connected:
- Public shop: reads active products from Supabase.
- Admin page: admin.html uses Supabase email/password login.
- Product image uploads: stored in the product-images bucket.
- Cart and WhatsApp checkout: stay on the customer device; orders are sent by WhatsApp.

One-time Supabase setup:
Run supabase-product-details.sql and supabase-admin-policies.sql in the Supabase SQL Editor, then create an Auth user for the shop owner from Authentication > Users. Use that same email to log in at admin.html.

Important:
The old local browser-only admin and its old test credentials are removed. Product changes and photos now require the authenticated admin account.
LOCAL STOCK TEST
================
This package is for checking the order flow before any Netlify upload.

1. Open index.html from the extracted folder.
2. Add an item to the cart, create the invoice, then press Send Invoice on WhatsApp.
3. Return to the site and refresh it: the item's stock must be lower by the ordered quantity.
4. The cart must be empty after sending.

The test keeps stock and order history only in this browser. It does not change the live Supabase stock.
After the test is approved, the same flow will be connected to Supabase so stock is shared for every customer online.
