/**
 * Thin wrapper around the local Ollama API.
 * All agents use this instead of calling Anthropic so the container
 * has zero external AI API costs.
 */

const OLLAMA_BASE = process.env.OLLAMA_URL ?? "http://192.168.4.172:11434";
const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? "qwen2.5-coder:14b-instruct-q4_K_M";

/**
 * Send a single prompt to Ollama and return the response text.
 * Uses the /api/chat endpoint with a system + user message pair.
 */
export async function ask(systemContent, userContent) {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.message?.content ?? "";
}

/**
 * Like ask(), but expects the response to contain valid JSON somewhere
 * in the text. Strips markdown fences and parses.
 * Throws if parsing fails after stripping.
 */
export async function askForJson(systemContent, userContent) {
  const raw = await ask(systemContent, userContent);

  // Strip ```json ... ``` fences that models often add
  const stripped = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Find the outermost [ ... ] or { ... } block
  const jsonStart = stripped.search(/[\[{]/);
  const jsonEnd = Math.max(
    stripped.lastIndexOf("]"),
    stripped.lastIndexOf("}")
  );

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON found in Ollama response:\n${raw.slice(0, 400)}`);
  }

  const jsonText = stripped.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(
      `JSON parse error from Ollama response: ${err.message}\n${jsonText.slice(0, 400)}`
    );
  }
}
