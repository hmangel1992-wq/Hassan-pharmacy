# AVARA — Phase 1 setup

## 1. Database (Supabase SQL Editor)
Run `phase1-settings-and-delivery.sql` once. It adds the settings table, the delivery fee on orders,
and a new `place_order` (stock + sale price + minimum order + delivery fee). Run it AFTER `fix-stock-and-sale.sql`.
Defaults are fee 0 and minimum 0, so checkout behaves as before until you change them.

## 2. Files to replace in the repo
- `index.html`, `admin.html`, `sw.js` (project root)
- `api/notify-order.js` (new, next to `api/chat.js`)
Push to GitHub; Vercel redeploys.

## 3. Fill in your store details
Open `/admin.html` > **Settings**: delivery fee, free-delivery threshold, minimum order, address,
map link, opening hours, delivery areas, payment methods and a trust statement. Blank lines stay hidden on the site.

## 4. Instant order alerts (Telegram, free)
1. In Telegram, message **@BotFather** > `/newbot` > copy the bot token.
2. Open a chat with your new bot and send it any message. Then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the number at `"chat":{"id": ...}`.
3. Vercel > Project > Settings > Environment Variables, add:
   - `NOTIFY_SECRET` = a long random string you invent
   - `TELEGRAM_BOT_TOKEN` = the token
   - `TELEGRAM_CHAT_ID` = the chat id
   Then redeploy.
4. Supabase > Database > Webhooks > Create a new hook:
   - Table: `orders`, Events: **Insert**
   - Type: HTTP Request, Method: POST
   - URL: `https://avara-nu-beige.vercel.app/api/notify-order`
   - HTTP Headers: add `x-webhook-secret` with the same value as `NOTIFY_SECRET`
5. Place a test order on the site. You should get a Telegram message within seconds.

Optional email too: add `RESEND_API_KEY` and `NOTIFY_EMAIL_TO` (and optionally `NOTIFY_EMAIL_FROM`).

## What customers see
- Cart shows subtotal, delivery fee (or "Free"), total, minimum-order and free-delivery hints.
- Product cards open a detail view (bigger gallery, description, WhatsApp question, share link, related items).
- Brand dropdown and an "On sale" chip appear on each department when they apply.
- Contact section shows address, hours, delivery and payment lines once you fill them in.
