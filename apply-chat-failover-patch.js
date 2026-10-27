#!/usr/bin/env node
/*
 * AVARA — chat assistant that never shows an error because a model is busy (503)
 *
 * Why customers saw errors: the chat asked ONE Gemini model and gave up (or waited) when Google said
 * "503 overloaded". That is a Google capacity problem on that one model, so asking the same model again is
 * not a real fix. This patch makes the chat fail over, in this order:
 *
 *   1. your main Gemini model                       (GEMINI_MODEL, as today)
 *   2. a second Gemini model                        (GEMINI_FALLBACK_MODEL, default gemini-flash-lite-latest)
 *   3. Claude, a different company's servers        (optional: add ANTHROPIC_API_KEY in Vercel; only used when Gemini fails)
 *   4. the main model once more
 *   5. if everything is busy: a short helpful answer made from your own catalogue (matching in-stock products
 *      with Add buttons, plus your WhatsApp number). The customer never sees an error page.
 *
 * Speed: if the main model has not answered after 3.5 seconds, the next one is started at the same time and the
 * first good answer wins. A model that just failed is skipped for 45 seconds (so the next customers get an
 * instant answer instead of waiting), and the whole thing never takes longer than about 9 seconds.
 *
 * Changes:  api/_llm.js (new file; the underscore keeps Vercel from publishing it as a web address)
 *           api/chat.js (works on your current file, and also if you already ran apply-chat-retry-patch.js)
 * Run from the project root:   node apply-chat-failover-patch.js
 * Then:  commit and push (no page rebuild is needed: only the server file changes).
 * Safe to run twice. If a line it expects is missing, it changes nothing and tells you which one.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHAT = ['api/chat.js', 'chat.js'].find((f) => fs.existsSync(f));
if (!CHAT) { console.error('Could not find api/chat.js. Run this from the project root.'); process.exit(1); }
const LLM = path.join(path.dirname(CHAT), '_llm.js');

/* ------------------------------------------------------------------ api/_llm.js */
const LLM_SRC = String.raw`// AVARA chat: talks to the AI models and fails over when one is busy (503) so customers never see an error.
// Order: main Gemini model -> second Gemini model -> Claude (optional) -> main model again.
// Environment variables (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY          required, as before
//   GEMINI_MODEL            main model (chat.js reads it)
//   GEMINI_FALLBACK_MODEL   second Gemini model, default gemini-flash-lite-latest
//   ANTHROPIC_API_KEY       optional: Claude as an independent backup (only called when Gemini fails)
//   ANTHROPIC_MODEL         optional, default claude-haiku-5-5
//   CHAT_BUDGET_MS          optional, total time allowed (default 9000)
//   CHAT_HEDGE_MS           optional, start the next model if the current one is this slow (default 3500)

const RETRYABLE = [408, 429, 500, 502, 503, 504, 529];
const BUDGET_MS = Number(process.env.CHAT_BUDGET_MS) || 9000;
const HEDGE_MS = Number(process.env.CHAT_HEDGE_MS) || 3500;
const COOLDOWN_MS = 45 * 1000;          // skip a model this long after it was busy
const BROKEN_MS = 10 * 60 * 1000;       // skip a model this long after "wrong key / wrong model name"

const tripped = {};                     // provider key -> time until which it is skipped (kept while the server stays warm)

async function callGemini(key, model, a, ms) {
  const gc = { temperature: 0.6, maxOutputTokens: 1024 };
  // Thinking controls differ by model generation (see chat.js): 2.5 uses a budget, 3.x uses a level.
  if (/^gemini-2\.5-flash/.test(model)) gc.thinkingConfig = { thinkingBudget: 0 };
  else if (/^gemini-3/.test(model)) gc.thinkingConfig = { thinkingLevel: 'low' };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: a.system }] }, contents: a.contents, generationConfig: gc }),
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) return { fail: r.status, body: (await r.text()).slice(0, 300) };
  const data = await r.json();
  const cand = data.candidates && data.candidates[0];
  const reply = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('').trim();
  if (!reply) return { fail: 'empty', body: JSON.stringify((cand && cand.finishReason) || data.promptFeedback || '') };
  return { reply: reply };
}

async function callClaude(key, model, a, ms) {
  const messages = a.contents.map((c) => ({
    role: c.role === 'model' ? 'assistant' : 'user',
    content: c.parts.map((p) => p.text).join(''),
  }));
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model, max_tokens: 700, temperature: 0.6, system: a.system, messages: messages }),
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) return { fail: r.status, body: (await r.text()).slice(0, 300) };
  const data = await r.json();
  const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!reply) return { fail: 'empty', body: String(data.stop_reason || '') };
  return { reply: reply };
}

function buildChain(a) {
  const gk = a.geminiKey;
  const main = a.model;
  const second = a.fallbackModel || process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
  const ck = process.env.ANTHROPIC_API_KEY;
  const cm = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  const list = [];
  if (gk && main) list.push({ name: 'gemini:' + main, key: 'gemini:' + main, run: (ms) => callGemini(gk, main, a, ms) });
  if (gk && second && second !== main) list.push({ name: 'gemini:' + second, key: 'gemini:' + second, run: (ms) => callGemini(gk, second, a, ms) });
  if (ck) list.push({ name: 'claude:' + cm, key: 'claude:' + cm, run: (ms) => callClaude(ck, cm, a, ms) });
  if (gk && main) list.push({ name: 'gemini:' + main + ' (again)', key: 'gemini:' + main, run: (ms) => callGemini(gk, main, a, ms) });
  const now = Date.now();
  const live = list.filter((p) => !(tripped[p.key] > now));
  return live.length ? live : list;     // if everything looks down, still try them all
}

function trip(p, r) {
  const code = r && r.fail;
  console.error('AI model failed', p.name, code, (r && r.body) || '');
  if (RETRYABLE.indexOf(code) >= 0 || code === 'timeout' || code === 'network') tripped[p.key] = Date.now() + COOLDOWN_MS;
  else if (code === 401 || code === 403 || code === 404) tripped[p.key] = Date.now() + BROKEN_MS;
}

// a = { system, contents, model, fallbackModel, geminiKey }
// Resolves { reply, via } on success or { busy: true } when every model failed or the time budget ran out.
function generate(a) {
  const chain = buildChain(a);
  const t0 = Date.now();
  return new Promise((resolve) => {
    let next = 0, pending = 0, done = false, hedge = null, stop = null;
    const finish = (v) => { if (done) return; done = true; clearTimeout(hedge); clearTimeout(stop); resolve(v); };
    stop = setTimeout(() => finish({ busy: true }), BUDGET_MS);
    const launch = () => {
      clearTimeout(hedge);
      if (done) return;
      if (next >= chain.length) { if (!pending) finish({ busy: true }); return; }
      const p = chain[next++];
      pending++;
      const left = Math.max(1500, BUDGET_MS - (Date.now() - t0) - 200);
      Promise.resolve()
        .then(() => p.run(left))
        .catch((e) => ({ fail: e && e.name === 'TimeoutError' ? 'timeout' : 'network', body: String((e && e.message) || e) }))
        .then((r) => {
          pending--;
          if (r && r.reply) return finish({ reply: r.reply, via: p.name });
          trip(p, r);
          launch();                      // it failed: go to the next model straight away
        });
      hedge = setTimeout(launch, HEDGE_MS);   // it is slow: start the next one too, the first good answer wins
    };
    launch();
  });
}

module.exports = { generate };
`;

/* ------------------------------------------------------------------ api/chat.js */
const HEAD_ANCHOR = 'module.exports = async function handler(req, res) {';
const HEAD_NEW = String.raw`const llm = require('./_llm');

// When every AI model is busy, the customer still gets a useful answer: matching in-stock products from the live
// catalogue (with the usual Add buttons) and your WhatsApp number, instead of an error.
const SKIP_WORDS = new Set(['the', 'and', 'for', 'with', 'you', 'your', 'have', 'has', 'what', 'which', 'that', 'this', 'can', 'are', 'how', 'any', 'some', 'need', 'want', 'best', 'good', 'please', 'hello', 'thanks', 'about', 'from', 'get', 'buy', 'does', 'not', 'but', 'care', 'avara', 'health', 'store', 'product', 'products', 'item', 'items']);
function offlineReply(lang, text, items) {
  const ar = /[؀-ۿ]/.test(text) || (lang === 'Arabic' && !/[a-z]/i.test(text));
  const words = String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !SKIP_WORDS.has(w));
  const scored = [];
  if (words.length) {
    items.forEach((p) => {
      const hay = [p.name_en, p.name_ar, p.brand, p.dept, p.collection, p.cat].filter(Boolean).join(' ').toLowerCase();
      const s = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
      if (s > 0) scored.push({ id: p.id, s: s });
    });
  }
  scored.sort((a, b) => b.s - a.s);
  const ids = scored.slice(0, MAX_RECOMMEND).map((x) => x.id);
  const msg = ar
    ? (ids.length
        ? 'المساعد مشغول جداً لحظة، وإليك منتجات من متجرنا قد تناسب ما تبحث عنه. للحصول على نصيحة شخصية، حاول مجدداً بعد قليل أو راسلنا عبر واتساب على 76 681 395.'
        : 'المساعد مشغول جداً لحظة. يرجى المحاولة بعد قليل، أو مراسلتنا عبر واتساب على 76 681 395 وسنساعدك.')
    : (ids.length
        ? 'Our assistant is very busy for a moment. Here are items from our store that may match what you are looking for. For personal advice, please try again shortly or message us on WhatsApp on 76 681 395.'
        : 'Our assistant is very busy for a moment. Please try again shortly, or message us on WhatsApp on 76 681 395 and we will help you.');
  return { text: msg, ids: ids };
}

module.exports = async function handler(req, res) {`;

const CALL_NEW = String.raw`    const out = await llm.generate({
      system: systemText,
      contents: contents,
      model: MODEL,
      fallbackModel: process.env.GEMINI_FALLBACK_MODEL || '',
      geminiKey: key,
    });
    if (!out.reply) {
      // Every model is busy: no error for the customer, a short helpful answer from the catalogue instead.
      const d = offlineReply(lang, lastText, items);
      return res.status(200).json({ reply: d.text, products: d.ids, degraded: true });
    }
    const reply = out.reply;`;

// The model call exists in two shapes: the original file, or the file after apply-chat-retry-patch.js.
const CALL_ORIGINAL = `    const r = await fetch(
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
    if (!reply) return res.status(502).json({ error: 'Empty reply' });`;

const CALL_RETRY = `    const out = await askGemini(key, JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig,
    }));
    if (out.busy) return res.status(503).json({ error: 'busy' });
    if (out.error) return res.status(502).json({ error: 'Upstream error' });
    const reply = out.reply;`;

const count = (t, s) => t.split(s).length - 1;
const plan = [];
const problems = [];

// api/_llm.js
{
  const exists = fs.existsSync(LLM);
  const old = exists ? fs.readFileSync(LLM, 'utf8') : null;
  if (old && old.replace(/\r\n/g, '\n') === LLM_SRC) console.log(LLM + ': already up to date');
  else plan.push({ file: LLM, raw: old, out: LLM_SRC });
}

// api/chat.js
{
  const raw = fs.readFileSync(CHAT, 'utf8');
  const crlf = raw.includes('\r\n');
  let t = raw.replace(/\r\n/g, '\n');
  if (t.includes("require('./_llm')")) {
    console.log(CHAT + ': already up to date');
  } else {
    const nOrig = count(t, CALL_ORIGINAL);
    const nRetry = count(t, CALL_RETRY);
    const nHead = count(t, HEAD_ANCHOR);
    if (nHead !== 1) problems.push(CHAT + ': expected 1 match but found ' + nHead + ' for: ' + HEAD_ANCHOR);
    if (nOrig + nRetry !== 1) problems.push(CHAT + ': could not find the place where the model is called (found ' + nOrig + ' original and ' + nRetry + ' retry-patched versions, expected exactly one). Please send me api/chat.js.');
    for (const need of ['const lastText =', 'const lang =', 'const items = await getCatalogue();', 'const MAX_RECOMMEND']) {
      if (count(t, need) < 1) problems.push(CHAT + ': missing line "' + need + '"');
    }
    if (!problems.length) {
      t = t.replace(nOrig ? CALL_ORIGINAL : CALL_RETRY, () => CALL_NEW);
      t = t.replace(HEAD_ANCHOR, () => HEAD_NEW);
      try { new vm.Script('(function(exports, require, module){' + t + '\n})', { filename: CHAT }); }
      catch (e) { problems.push(CHAT + ': the changed file would not be valid JavaScript (' + e.message + ')'); }
      if (!problems.length) plan.push({ file: CHAT, raw, out: crlf ? t.replace(/\n/g, '\r\n') : t });
    }
  }
}

if (problems.length) {
  console.error('Nothing was changed. Please send me the file named below and I will adjust the patch:\n');
  problems.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
for (const p of plan) {
  if (p.raw !== null) fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
  console.log(p.file + ': ' + (p.raw !== null ? 'updated (backup saved as ' + p.file + '.bak)' : 'created'));
}
if (plan.length) {
  console.log('\nNext: commit and push (no rebuild needed).');
  console.log('Recommended in Vercel > Settings > Environment Variables: add ANTHROPIC_API_KEY (Claude as an independent backup), then redeploy.');
}
