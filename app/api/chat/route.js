// This file runs ONLY on the server. Next.js never sends route handler
// code to the browser, so process.env.ANTHROPIC_API_KEY is never exposed.
export const runtime = 'nodejs';

const MODEL = 'claude-sonnet-5'; // update if you want a different model

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // This means the env var isn't set on the server/host — check your
    // deployment platform's environment variable settings.
    return Response.json(
      { error: { message: 'Server misconfigured: ANTHROPIC_API_KEY is not set.' } },
      { status: 500 }
    );
  }

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system,
        messages,
      }),
    });
  } catch (e) {
    return Response.json(
      { error: { message: 'Could not reach the Anthropic API: ' + e.message } },
      { status: 502 }
    );
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return Response.json(
      { error: { message: `Anthropic API returned a non-JSON response (status ${upstream.status})` } },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    // Pass the REAL upstream error straight through — this is what makes
    // failures debuggable instead of a generic "API problem" message.
    return Response.json({ error: data?.error || { message: `Upstream error (${upstream.status})` } }, {
      status: upstream.status,
    });
  }

  return Response.json(data);
}
