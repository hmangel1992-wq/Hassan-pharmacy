// AVARA chat: talks to the AI models and fails over when one is busy (503) so customers never see an error.
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
