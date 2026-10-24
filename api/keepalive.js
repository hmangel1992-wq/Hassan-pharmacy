// Vercel serverless function: GET /api/keepalive (called once a day by a Vercel Cron Job, see vercel.json).
// Reads one product row so Supabase sees activity and does not pause the free project. It changes nothing.

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wmmgzwjiaoyjilftkjir.supabase.co').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtbWd6d2ppYW95amlsZnRramlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzMxNzAsImV4cCI6MjEwNTgwOTE3MH0.ta9s3UliyYC12vnZhaeySGgrVydKm5tqSF4xVIRwr0k';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!r.ok) { console.error('keepalive: supabase', r.status); return res.status(502).json({ ok: false, status: r.status }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('keepalive failed', e);
    return res.status(502).json({ ok: false });
  }
};
