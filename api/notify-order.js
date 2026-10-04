// Vercel serverless function: POST /api/notify-order
// Called by a Supabase Database Webhook every time a row is inserted into
// public.orders. It tells the store owner about the new order instantly via
// Telegram and/or email. Secrets stay in Vercel environment variables.
//
// Required env:  NOTIFY_SECRET            (same value as the webhook header)
// Telegram:      TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Email (Resend):RESEND_API_KEY, NOTIFY_EMAIL_TO, optional NOTIFY_EMAIL_FROM
// Optional:      SITE_URL  (default https://avara-nu-beige.vercel.app)

const crypto = require('crypto');

const SITE = (process.env.SITE_URL || 'https://avara-nu-beige.vercel.app').replace(/\/$/, '');

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

// Lebanese local numbers (8 digits, e.g. 76 681 395 or 03 123 456) need 961 in front for wa.me.
function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length <= 8) d = '961' + d.replace(/^0+/, '');
  return d;
}

const money = (n) => '$' + Number(n || 0).toFixed(2);

function buildText(o) {
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((i) => `- ${i.qty} x ${i.name_en || 'Item'} (${money(i.price)})`)
    .join('\n');
  const lines = [
    `New AVARA order #${o.order_no}`,
    `Total: ${money(o.total)}` + (Number(o.delivery_fee) > 0 ? ` (includes delivery ${money(o.delivery_fee)})` : ''),
    '',
    `Customer: ${o.customer_name}`,
    `Phone: ${o.phone}`,
    `WhatsApp: https://wa.me/${waNumber(o.phone)}`,
  ];
  if (o.address) lines.push(`Address: ${o.address}`);
  if (o.notes) lines.push(`Notes: ${o.notes}`);
  lines.push('', 'Items:', items, '', `Manage: ${SITE}/admin.html`);
  return lines.join('\n').slice(0, 4000);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return null;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error('Telegram ' + r.status + ' ' + (await r.text()));
  return 'telegram';
}

async function sendEmail(subject, text) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!key || !to) return null;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: process.env.NOTIFY_EMAIL_FROM || 'AVARA Orders <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text()));
  return 'email';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.NOTIFY_SECRET;
  if (!secret) return res.status(500).json({ error: 'Server is not configured' });
  if (!safeEqual(req.headers['x-webhook-secret'], secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const order = body.record;
    if (body.type !== 'INSERT' || body.table !== 'orders' || !order) {
      return res.status(200).json({ ignored: true });
    }

    const text = buildText(order);
    const results = await Promise.allSettled([
      sendTelegram(text),
      sendEmail(`New AVARA order #${order.order_no}`, text),
    ]);

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
    results.forEach((r) => { if (r.status === 'rejected') console.error('notify failed', r.reason); });

    if (!sent.length) return res.status(502).json({ error: 'No notification channel succeeded' });
    return res.status(200).json({ sent });
  } catch (err) {
    console.error('notify-order failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
