import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-opus-4-6";

// ---------------------------------------------------------------------------
// Shared prompt helpers
// ---------------------------------------------------------------------------

export function systemPrompt(role: string): string {
  return `You are ${role}. Always respond with valid JSON only — no markdown fences, no explanations, just the raw JSON object or array requested.`;
}

/**
 * Ask Claude for JSON and parse the result.
 * Retries once on parse failure.
 */
export async function askForJson<T>(
  system: string,
  userMessage: string
): Promise<T> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    return JSON.parse(text) as T;
  } catch {
    // Strip any accidental markdown fences and retry
    const cleaned = text.replace(/^```[a-z]*\n?/m, "").replace(/```$/m, "").trim();
    return JSON.parse(cleaned) as T;
  }
}
