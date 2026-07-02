import "server-only";

// ACE Data Cloud client (OpenAI-compatible). Powers the natural-language strategy compiler.
//   POST https://api.acedata.cloud/v1/chat/completions   Authorization: Bearer <ACE_API_KEY>

const ACE_BASE = process.env.ACE_API_BASE ?? "https://api.acedata.cloud";
const ACE_KEY = process.env.ACE_API_KEY;

export function aceConfigured(): boolean {
  return Boolean(ACE_KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function aceChat(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  if (!ACE_KEY) throw new Error("ACE_API_KEY not set");

  const res = await fetch(`${ACE_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACE_KEY}` },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature ?? 0.3,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`ACE chat ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json?.choices?.[0]?.message?.content ?? "";
}

/** Extract a JSON object from an LLM reply, tolerating ```json fences or stray prose. */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
