# AVARA — Supabase setup

## 1. Create the project
Supabase dashboard > **New project**. Name it `avara`, choose a region close to Lebanon
(e.g. Frankfurt), set a strong database password and keep it somewhere safe.

## 2. Create the database
Dashboard > **SQL Editor** > New query. Paste all of `supabase/schema.sql` > **Run**.
Then (optional) paste `supabase/seed.sql` > **Run** to load the 24 sample products.

## 3. Lock down sign-ups
Dashboard > **Authentication > Sign In / Providers** (or Settings) > turn **off** "Allow new users to sign up".
Only you should be able to have an account.

## 4. Create your admin login
1. **Authentication > Users > Add user > Create new user**. Enter your email and a strong password,
   and tick **Auto Confirm User**.
2. In the SQL Editor run (use the same email):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'YOUR-EMAIL@example.com';
```

## 5. Connect the site
Dashboard > **Project Settings > API**. Copy the **Project URL** and the **anon / publishable key**
into `config.js`:

```js
window.AVARA_CONFIG = {
  url:     'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJ...'
};
```
The anon key is meant to be public. Never put the `service_role` key anywhere in the site.

## 6. Deploy
```bash
git add .
git commit -m "Connect Supabase: product catalogue, orders and admin dashboard"
git push
```
Vercel redeploys automatically. Then open `https://YOUR-SITE.vercel.app/admin.html` and sign in.

## How it is protected
- The public can only **read visible products** and **call `place_order`**. They cannot read orders or change products.
- Prices are re-read from the database when an order is placed, so they cannot be edited in the browser.
- Only users listed in `public.admins` can add/edit/delete products, upload images and see orders.
- `admin.html` is not linked from the store and is marked `noindex`, but security comes from the database rules, not from hiding the page.

## Good to know
- Orders arrive in **admin.html > Orders** (refreshes every minute). New orders show a badge.
- Customers also get a WhatsApp button after ordering, using 76 681 395.
- There is no rate limit on `place_order`. If you ever get spam orders, add Cloudflare Turnstile or ask me to add a limit.
