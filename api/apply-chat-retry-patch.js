#!/usr/bin/env node
/*
 * AVARA — make the chat assistant survive Gemini "503 / busy" moments
 *   Your logs show Google's Gemini model sometimes answers 503 (temporarily overloaded). Until now the chat
 *   gave up on the first failure and the customer saw "Sorry, something went wrong".
 *   After this patch (api/chat.js):
 *     - it retries automatically (up to 4 tries, short waits, never longer than about 8 seconds in total) when
 *       Gemini answers 429, 500, 502, 503 or 504, or when it returns an empty answer
 *     - errors that retrying cannot fix (400, 401, 403, 404, for example a wrong model name) stop at once
 *     - optional: set GEMINI_FALLBACK_MODEL in Vercel (Settings > Environment Variables) to a second model name,
 *       and the 3rd and 4th tries use it when the main model is overloaded
 *     - the reply has more room (1024 instead of 700 tokens), so the model's "thinking" cannot leave it empty
 *     - if Gemini is still busy after all tries, the customer sees "our assistant is very busy, try again in a
 *       moment or message us on WhatsApp" instead of the generic error (needs the template change below)
 *   And tools/template.html gets that friendlier message (English and Arabic).
 *
 * Run from the project root:   node apply-chat-retry-patch.js
 * Then:  node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const FILES = { chat: first(['api/chat.js', 'chat.js']), template: first(['tools/template.html', 'template.html']) };
for (const [k, v] of Object.entries(FILES)) {
  if (!v) { console.error('Could not find the ' + k + ' file. Run this from the project root.'); process.exit(1); }
}

const chat = [], C = (f, r) => chat.push([f, r]);
const tpl = [], T = (f, r) => tpl.push([f, r]);

/* ---------------------------------------------------------------- api/chat.js */
C('const MAX_RECOMMEND = 3;',
  "const MAX_RECOMMEND = 3;\n// Optional second model used on the 3rd and 4th try when the main model is overloaded (set in Vercel env vars).\nconst FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || '';");

C('module.exports = async function handler(req, res) {',
`// Calls Gemini and retries when it is busy. Returns {reply}, {busy: true} (still busy after every try) or {error: true}.
const RETRY_STATUS = [429, 500, 502, 503, 504];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function askGemini(key, payload) {
  const started = Date.now();
  let last = { error: true };
  for (let attempt = 0; attempt < 4; attempt++) {
    const model = attempt >= 2 && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL ? FALLBACK_MODEL : MODEL;
    if (attempt > 0) {
      if (Date.now() - started > 8000) break;   // do not run into the function time limit
      await sleep(attempt * 600);
    }
    try {
      const r = await fetch(
        \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: payload,
          signal: AbortSignal.timeout(15000),
        }
      );
      if (r.ok) {
        const data = await r.json();
        const reply = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
        if (reply) return { reply };
        console.error('Gemini empty reply', model, JSON.stringify(data.candidates?.[0]?.finishReason || data.promptFeedback || ''));
        last = { error: true };
        continue;
      }
      console.error('Gemini error', r.status, model, (await r.text()).slice(0, 300));
      if (!RETRY_STATUS.includes(r.status)) return { error: true };   // retrying will not help (bad key, wrong model name...)
      last = { busy: true };
    } catch (e) {
      console.error('Gemini request failed', e);
      last = { busy: true };
    }
  }
  return last;
}

module.exports = async function handler(req, res) {`);

C('const generationConfig = { temperature: 0.6, maxOutputTokens: 700 };',
  'const generationConfig = { temperature: 0.6, maxOutputTokens: 1024 };');

C(`    const r = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL}:generateContent\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
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
    if (!reply) return res.status(502).json({ error: 'Empty reply' });`,
`    const out = await askGemini(key, JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig,
    }));
    if (out.busy) return res.status(503).json({ error: 'busy' });
    if (out.error) return res.status(502).json({ error: 'Upstream error' });
    const reply = out.reply;`);

/* ---------------------------------------------------------------- template.html */
T("langBtn:'العربية'",
  "chat_busy:'Our assistant is very busy right now. Please try again in a moment, or message us on WhatsApp on 76 681 395.',\n      langBtn:'العربية'");
T("langBtn:'English'",
  "chat_busy:'المساعد مشغول جداً الآن. يرجى المحاولة بعد لحظات، أو مراسلتنا عبر واتساب على 76 681 395.',\n      langBtn:'English'");
T("if(res.status === 429) chatLog.push({role: 'error', text: t('chat_rate')});",
  "if(res.status === 429) chatLog.push({role: 'error', text: t('chat_rate')});\n        else if(res.status === 503) chatLog.push({role: 'error', text: t('chat_busy')});");

/* ---------------------------------------------------------------- run (all or nothing) */
const jobs = [
  { file: FILES.chat, edits: chat, done: 'askGemini' },
  { file: FILES.template, edits: tpl, done: 'chat_busy' },
];
const plan = [];
let problems = 0;
for (const j of jobs) {
  const raw = fs.readFileSync(j.file, 'utf8');
  const crlf = raw.includes('\r\n');
  let t = raw.replace(/\r\n/g, '\n');
  if (t.includes(j.done)) { console.log(j.file + ': already up to date'); continue; }
  for (const [find] of j.edits) {
    const n = t.split(find).length - 1;
    if (n !== 1) { problems++; console.error(j.file + ': expected one match but found ' + n + ' for:\n  ' + find.split('\n')[0].slice(0, 110)); }
  }
  if (problems) continue;
  for (const [find, replace] of j.edits) t = t.replace(find, () => replace);
  plan.push({ file: j.file, raw, out: crlf ? t.replace(/\n/g, '\r\n') : t });
}
if (problems) { console.error('\nNothing was changed. Send me the file(s) named above and I will adjust the patch.'); process.exit(1); }
for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
  console.log(p.file + ': updated (backup saved as ' + p.file + '.bak)');
}
if (plan.length) console.log('\nNext: node tools/build-pages.js   then commit and push.');
