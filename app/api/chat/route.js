// This file runs ONLY on the server. Next.js never sends route handler
// code to the browser, so process.env.BYTEZ_API_KEY is never exposed.
export const runtime = 'nodejs';

// Bytez's free tier covers open models up to 7B params. Change this to
// any model id listed at https://bytez.com/models — e.g. prefix with
// "openai/" or "anthropic/" to use a closed-source provider instead
// (billed pass-through, not covered by the free credits).
const MODEL = 'Qwen/Qwen2.5-7B-Instruct';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: { message: 'Invalid JSON in request body' } }, { status: 400 });
  }

  const { system, messages } = body || {};
  if (!Array.isArray(messages)) {
    return Response.json({ error: { message: 'Request must include a messages array' } }, { status: 400 });
  }

  const apiKey = process.env.BYTEZ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { message: 'Server misconfigured: BYTEZ_API_KEY is not set.' } },
      { status: 500 }
    );
  }

  // Bytez's chat endpoint is OpenAI-compatible: system is just another
  // message with role "system", placed first.
  const fullMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

  let upstream;
  try {
    upstream = await fetch('https://api.bytez.com/models/v2/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: fullMessages,
        max_completion_tokens: 1000,
        temperature: 0.7,
      }),
    });
  } catch (e) {
    return Response.json(
      { error: { message: 'Could not reach the Bytez API: ' + e.message } },
      { status: 502 }
    );
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return Response.json(
      { error: { message: `Bytez API returned a non-JSON response (status ${upstream.status})` } },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return Response.json(
      { error: data?.error || { message: data?.message || `Upstream error (${upstream.status})` } },
      { status: upstream.status }
    );
  }

  const text = data?.choices?.[0]?.message?.content || '';

  // Return in the SAME shape the frontend already expects (Anthropic-style
  // { content: [{ text }] }) — so DreamrApp.jsx needs zero changes.
  return Response.json({ content: [{ type: 'text', text }] });
}
