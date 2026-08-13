PET UNLEASH V15

Changes in this build:
- Removed the top “Free delivery on orders over $70” bar.
- Replaced the local catalog with 590 products parsed from new trixie.csv.
- Every V15 product starts with Stock = 0 so quantities can be entered manually in Admin.
- Old browser-local stock uses a new V15 storage key and will not carry over.
- Includes the fixed Admin camera/barcode/OCR build.
- replace-products-v15.sql is included for replacing the LIVE Supabase catalog.

For a local visual test, open index.html.
For live Supabase replacement, review and run replace-products-v15.sql in Supabase SQL Editor.
