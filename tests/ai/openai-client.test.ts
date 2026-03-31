import { z } from "zod";

import { callOpenAiResponsesApi, extractOutputText } from "@/lib/ai/openai-client";

const testSchema = z.object({
  name: z.string(),
  score: z.number(),
});

const testJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    score: { type: "number" },
  },
  required: ["name", "score"],
} as const;

describe("extractOutputText", () => {
  it("extracts from output_text shorthand", () => {
    expect(extractOutputText({ output_text: '{"a":1}' })).toBe('{"a":1}');
  });

  it("extracts from nested output[].content[].text", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"name":"test"}' }],
        },
      ],
    };

    expect(extractOutputText(payload)).toBe('{"name":"test"}');
  });

  it("extracts from nested output[].content[].parsed", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", parsed: { name: "test" } }],
        },
      ],
    };

    expect(extractOutputText(payload)).toBe('{"name":"test"}');
  });

  it("returns null for unrecognised payload shapes", () => {
    expect(extractOutputText({})).toBeNull();
    expect(extractOutputText(null)).toBeNull();
    expect(extractOutputText({ output: [] })).toBeNull();
  });
});

describe("callOpenAiResponsesApi", () => {
  it("parses a valid structured response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: '{"name":"Acme","score":42}' }), {
        status: 200,
      }),
    );

    const result = await callOpenAiResponsesApi({
      systemPrompt: "test prompt",
      userContent: "test input",
      jsonSchemaName: "test_schema",
      jsonSchema: testJsonSchema,
      zodSchema: testSchema,
      apiKey: "test-key",
      fetchFn,
    });

    expect(result).toEqual({ name: "Acme", score: 42 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output_text: '{"name":"Retry","score":1}' }), {
          status: 200,
        }),
      );

    const result = await callOpenAiResponsesApi({
      systemPrompt: "test",
      userContent: "test",
      jsonSchemaName: "test_schema",
      jsonSchema: testJsonSchema,
      zodSchema: testSchema,
      apiKey: "test-key",
      fetchFn,
    });

    expect(result).toEqual({ name: "Retry", score: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 500", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response("server error", { status: 500 }));

    await expect(
      callOpenAiResponsesApi({
        systemPrompt: "test",
        userContent: "test",
        jsonSchemaName: "test_schema",
        jsonSchema: testJsonSchema,
        zodSchema: testSchema,
        apiKey: "test-key",
        fetchFn,
        maxRetries: 2,
      }),
    ).rejects.toThrow(/status 500/);

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on 400 without retrying", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response("bad request", { status: 400 }));

    await expect(
      callOpenAiResponsesApi({
        systemPrompt: "test",
        userContent: "test",
        jsonSchemaName: "test_schema",
        jsonSchema: testJsonSchema,
        zodSchema: testSchema,
        apiKey: "test-key",
        fetchFn,
      }),
    ).rejects.toThrow(/status 400/);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws when response has no structured output", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output: [] }), { status: 200 }),
    );

    await expect(
      callOpenAiResponsesApi({
        systemPrompt: "test",
        userContent: "test",
        jsonSchemaName: "test_schema",
        jsonSchema: testJsonSchema,
        zodSchema: testSchema,
        apiKey: "test-key",
        fetchFn,
      }),
    ).rejects.toThrow(/did not contain structured output/);
  });

  it("uses envModelKey to resolve model", async () => {
    process.env.TEST_MODEL = "gpt-4o-mini";

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: '{"name":"M","score":0}' }), {
        status: 200,
      }),
    );

    await callOpenAiResponsesApi({
      envModelKey: "TEST_MODEL",
      systemPrompt: "test",
      userContent: "test",
      jsonSchemaName: "test_schema",
      jsonSchema: testJsonSchema,
      zodSchema: testSchema,
      apiKey: "test-key",
      fetchFn,
    });

    const calledBody = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(calledBody.model).toBe("gpt-4o-mini");

    delete process.env.TEST_MODEL;
  });
});
