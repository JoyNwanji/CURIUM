const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const CLOUDFLARE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_HISTORY_TURNS = 8;
const MAX_SOURCES = 8;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function sourcePrompt(sources = []) {
  return sources.slice(0, MAX_SOURCES).map((source, index) =>
    `[${index + 1}] ${String(source.title || 'Learning source').slice(0, 180)} — ${String(source.source || '').slice(0, 120)}\n${String(source.description || '').slice(0, 1600)}\nURL: ${String(source.url || '').slice(0, 500)}`
  ).join('\n\n');
}

function makeSystemPrompt(profile, sources) {
  const learner = [profile.education, profile.level, profile.course, profile.department].filter(Boolean).join(' · ');
  return `You are Curium, a careful learning assistant for students. Explain the answer clearly at the student's level${learner ? ` (${learner})` : ''}. Use the supplied sources as evidence. Cite factual claims with the source number like [1]. If a source does not support an answer, say what is missing; do not invent curriculum rules, facts, or citations. Distinguish Nigerian curriculum guidance from a university's own course requirements. Keep the answer focused and useful, with a short explanation and steps or an example when supported.\n\nSupplied sources:\n${sourcePrompt(sources) || 'No sources were found. Explain that you need a source to answer reliably.'}`;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY_TURNS).map(turn => ({
    role: turn.role === 'assistant' ? 'assistant' : 'user',
    content: String(turn.content || '').slice(0, 2500)
  })).filter(turn => turn.content);
}

async function askGemini(env, messages, system) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini key is not configured');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
      generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
    })
  });
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = await response.json();
  const answer = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
  if (!answer) throw new Error('Gemini returned an empty answer');
  return { answer, provider: 'Gemini' };
}

async function askWorkersAI(env, messages, system) {
  if (!env.AI?.run) throw new Error('Workers AI binding is not configured');
  const result = await env.AI.run(CLOUDFLARE_MODEL, {
    messages: [{ role: 'system', content: system }, ...messages.map(message => ({ role: message.role, content: message.content }))],
    max_tokens: 900,
    temperature: 0.25
  });
  const answer = result.response || result.choices?.[0]?.message?.content || '';
  if (!answer) throw new Error('Workers AI returned an empty answer');
  return { answer: String(answer).trim(), provider: 'Workers AI' };
}

async function askOpenRouter(env, messages, system) {
  if (!env.OPENROUTER_API_KEY) throw new Error('OpenRouter key is not configured');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'x-title': 'Curium'
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [{ role: 'system', content: system }, ...messages.map(message => ({ role: message.role, content: message.content }))],
      temperature: 0.25,
      max_tokens: 900
    })
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error('OpenRouter returned an empty answer');
  return { answer: String(answer).trim(), provider: 'OpenRouter' };
}

async function answerQuestion(request, env) {
  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ error: 'Send a valid research question.' }, 400); }

  const question = String(input.question || '').trim().slice(0, 1200);
  if (!question) return jsonResponse({ error: 'Enter a research question.' }, 400);
  const history = normalizeHistory(input.history);
  history.push({ role: 'user', content: question });
  const system = makeSystemPrompt(input.profile || {}, input.sources || []);
  const providers = [
    () => askGemini(env, history, system),
    () => askWorkersAI(env, history, system),
    () => askOpenRouter(env, history, system)
  ];
  const failures = [];
  for (const provider of providers) {
    try {
      const result = await provider();
      return jsonResponse({ ...result, sources: (input.sources || []).slice(0, MAX_SOURCES).map((source, index) => ({ ...source, number: index + 1 })) });
    } catch (error) {
      failures.push(error.message || 'Provider unavailable');
    }
  }
  return jsonResponse({ error: 'All configured AI providers are unavailable. Check provider keys, quotas, and the Workers AI binding.', providers: failures }, 503);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/research') {
      if (request.method !== 'POST') return jsonResponse({ error: 'Use POST for research questions.' }, 405);
      return answerQuestion(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
