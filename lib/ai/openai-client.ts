import { z } from "zod";

type OpenAiResponsesApiOptions<T extends z.ZodTypeAny> = {
  model?: string;
  envModelKey?: string;
  /**
   * When set to "light", the fallback model resolves from OPENAI_LIGHT_MODEL
   * (default: "gpt-4o-mini") instead of OPENAI_MODEL_PAIN_HYPOTHESIS / "gpt-4o".
   * Use for simpler tasks (QA checks, summarisation) to reduce costs.
   */
  modelTier?: "default" | "light";
  systemPrompt: string;
  userContent: string;
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: T;
  apiKey?: string;
  fetchFn?: typeof fetch;
  maxRetries?: number;
};

function resolveApiKey(apiKey?: string): string {
  const resolved = apiKey ?? process.env.OPENAI_API_KEY;

  if (!resolved) {
    throw new Error("OpenAI API key is required.");
  }

  return resolved;
}

/** Default light model for cost-sensitive tasks (QA, summarisation). Override via OPENAI_LIGHT_MODEL env var. */
const DEFAULT_LIGHT_MODEL = "gpt-4o-mini";

function resolveModel(options: {
  model?: string;
  envModelKey?: string;
  modelTier?: "default" | "light";
}): string {
  if (options.model) return options.model;

  if (options.envModelKey) {
    const envModel = process.env[options.envModelKey];
    if (envModel) return envModel;
  }

  if (options.modelTier === "light") {
    return process.env.OPENAI_LIGHT_MODEL ?? DEFAULT_LIGHT_MODEL;
  }

  return process.env.OPENAI_MODEL_PAIN_HYPOTHESIS ?? "gpt-4o";
}

export function extractOutputText(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const outputItem of payload.output) {
      if (
        outputItem &&
        typeof outputItem === "object" &&
        "content" in outputItem &&
        Array.isArray(outputItem.content)
      ) {
        for (const contentItem of outputItem.content) {
          if (
            contentItem &&
            typeof contentItem === "object" &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            return contentItem.text;
          }

          if (
            contentItem &&
            typeof contentItem === "object" &&
            "parsed" in contentItem &&
            contentItem.parsed &&
            typeof contentItem.parsed === "object"
          ) {
            return JSON.stringify(contentItem.parsed);
          }
        }
      }
    }
  }

  return null;
}

export async function callOpenAiResponsesApi<T extends z.ZodTypeAny>(
  options: OpenAiResponsesApiOptions<T>,
): Promise<z.infer<T>> {
  const apiKey = resolveApiKey(options.apiKey);
  const fetchFn = options.fetchFn ?? fetch;
  const model = resolveModel(options);
  const maxRetries = options.maxRetries ?? 3;

  const body = JSON.stringify({
    model,
    input: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userContent },
    ],
    text: {
      format: {
        type: "json_schema",
        name: options.jsonSchemaName,
        strict: true,
        schema: options.jsonSchema,
      },
    },
  });

  let response: Response | undefined;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (response.ok) break;

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(
        `OpenAI ${options.jsonSchemaName} request failed with status ${response.status}.`,
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
    }

    break;
  }

  if (!response?.ok) {
    throw (
      lastError ??
      new Error(
        `OpenAI ${options.jsonSchemaName} request failed with status ${response?.status}.`,
      )
    );
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error(
      `OpenAI response did not contain structured output text for ${options.jsonSchemaName}.`,
    );
  }

  return options.zodSchema.parse(JSON.parse(outputText));
}
