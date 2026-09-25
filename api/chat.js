// Vercel serverless function: POST /api/chat
// Keeps the Gemini API key on the server (GEMINI_API_KEY env var), never in the browser.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'; // GA since Sep 2026; gemini-2.5-flash was retired Jun 17 2026
const MAX_TURNS = 12;
const MAX_CHARS = 1000;

const SYSTEM = `You are the AVARA Health Care Assistant for AVARA, a health care and cosmetics store whose tagline is "Inspired by Nature. Perfected by Science."

The store has three departments: Medical advice (vitamins, first aid, home devices), Athlete section (recovery, hydration and nutrition, sun protection) and Beauty section (serums, moisturisers, cleansers and masks).

Rules:
- Give clear, professional, general health and skin care information. You are not a doctor: never diagnose, never prescribe, and never give personal dosing beyond what a product label states.
- For anything persistent, severe, or involving medication interactions, pregnancy, children or chronic conditions, advise speaking to a doctor or pharmacist.
- For possible emergencies (chest pain, trouble breathing, severe bleeding, stroke signs, overdose, thoughts of self-harm), tell the person to contact local emergency services immediately.
- You may point people to the relevant AVARA department, but do not invent products, prices or stock. For orders, they can use the cart or WhatsApp on 76 681 395.
- Reply in the language the person writes in. If unsure, use the site language given below.
- Write plain text only: no markdown, no asterisks, no headings. Keep answers short (under about 120 words) and warm but professional.
- Stay on topic: health care, athlete recovery, skin care and the AVARA store. Politely decline anything else.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const lang = body.lang === 'ar' ? 'Arabic' : 'English';

    let contents = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_CHARS) }] }));

    // Gemini expects the conversation to start with, and end on, a user turn.
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length || contents[contents.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Invalid messages' });
    }

    const generationConfig = { temperature: 0.6, maxOutputTokens: 700 };
    // "Thinking" controls differ by model generation: 2.5 models use thinkingBudget
    // (0 disables it); Gemini 3 models use thinkingLevel instead and cannot fully
    // disable thinking, so "low" is the fastest/cheapest setting available.
    if (/^gemini-2\.5-flash/.test(MODEL)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    else if (/^gemini-3/.test(MODEL)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${SYSTEM}\n\nSite language: ${lang}.` }] },
          contents,
          generationConfig,
        }),
      }
    );

    if (!r.ok) {
      console.error('Gemini error', r.status, await r.text());
      return res.status(502).json({ error: 'Upstream error' });
    }

    const data = await r.json();
    const reply = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    if (!reply) return res.status(502).json({ error: 'Empty reply' });

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('chat handler failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
