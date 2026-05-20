import { env } from "../env";

// Anthropic Messages-compatible gateway (patunganai). The gateway selects the
// model itself, so we never send a `model` field.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function chat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<ChatResult> {
  // Anthropic puts the system prompt at the top level, not in `messages`.
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const messages = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch(env.llmGatewayUrl(), {
    method: "POST",
    headers: {
      "x-api-key": env.llmGatewayKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      max_tokens: opts.max_tokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      stream: false,
      ...(system ? { system } : {}),
      messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM gateway error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as AnthropicResponse;
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("")
    .trim();

  return {
    text,
    model: json.model ?? "gateway",
    usage: {
      prompt_tokens: json.usage?.input_tokens ?? 0,
      completion_tokens: json.usage?.output_tokens ?? 0,
    },
  };
}
