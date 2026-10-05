# AVARA — Phase 3 setup (be found, be fast)

## What changed
- The store is now **six real pages**, each with its own address, title, description and Arabic/English twin:
  `/` and `/ar/` (Medical care), `/beauty` and `/ar/beauty`, `/athlete` and `/ar/athlete`.
- Every product has its own page: `/p/<name>-<id>` and `/ar/p/<name>-<id>` (server-rendered, with Product structured data and a
  proper preview image for WhatsApp). The **Share** button in the product window now shares this link.
- `/sitemap.xml` is generated automatically from your visible products. `robots.txt` points to it.
- The Supabase library is now hosted on your own site (`/vendor/`), pinned to one version, and scripts no longer block the first paint.
- The visible hero image is preloaded; the hidden departments' images wait until needed.
- Each page has a hidden-but-readable main heading (H1) for search engines and screen readers.

## 1. Deploy (all in one push)
Copy into the repo, keeping the folders:
- Pages: `index.html`, `beauty.html`, `athlete.html`, `ar/index.html`, `ar/beauty.html`, `ar/athlete.html`
- `policies.html`, `admin.html`, `sw.js`, `vercel.json`, `robots.txt`
- `vendor/supabase-2.45.4.js` and `vendor/591.supabase.js`
- `api/product.js`, `api/sitemap.js` (next to `api/chat.js` and `api/notify-order.js`)
- `tools/template.html` and `tools/build-pages.js` (the source for the six pages; not served to visitors)
If you already had a `vercel.json`, replace it with this one (it contains the earlier security headers too).

## 2. Check after deploying
1. Open each of the six addresses. Each should show the right department; the language button should jump to the twin page.
2. Open `/sitemap.xml`: you should see your pages and one entry per product, in both languages.
3. Open a product page: in the store, click a product > Share (or open `/p/...` from the sitemap). Check the title, price and photo.
4. Paste a product link into WhatsApp: the preview should show the product photo and name.
5. Old shared links like `/#p-<id>` still work; they open the product in its department.

## 3. Tell Google (about 20 minutes, one time)
1. https://search.google.com/search-console > add your site > verify (Vercel domain or HTML tag method).
2. Sitemaps > submit `sitemap.xml`.
3. URL Inspection > request indexing for `/`, `/beauty`, `/athlete`, `/ar/`.
4. Create a **Google Business Profile** for your shop (address, hours, phone, category). For a local store this brings more
   customers than anything else on this list. Use the same name, address and phone as in admin > Settings.
5. Optional: add the same sitemap to Bing Webmaster Tools.

## 4. Editing the storefront from now on
`tools/template.html` is the one source for the six pages. After any change to it, regenerate:
    npm install --no-save jsdom
    node tools/build-pages.js
(or just ask me to apply the change and regenerate). Do not edit the six generated pages by hand: the next build overwrites them.
If you move to your own domain, run `SITE_URL=https://your-domain.com node tools/build-pages.js`, set `SITE_URL` in Vercel,
and update the Sitemap line in `robots.txt`.

## 5. Still to do on your side (speed and visuals)
- **Hero banners:** the headlines are part of the picture. Search engines can't read them (the alt text and hidden H1 cover that), and they
  can't be edited. For a real fix, send me versions of the banners *without* the text and I'll overlay real, translatable text.
- **Image weight:** convert the three hero JPGs and your product photos to WebP (squoosh.app, quality ~80). Tell me when they are uploaded
  and I'll switch the pages to use them. Target: hero under ~150 KB.
- Run https://pagespeed.web.dev on `/` and `/beauty` (mobile). Send me the report if the score is below 90.
