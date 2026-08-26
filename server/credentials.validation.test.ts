import { describe, expect, it } from "vitest";

const hasSerpApiKey = Boolean(process.env.SERPAPI_API_KEY);
const hasHfToken = Boolean(process.env.HF_TOKEN);

describe("configured provider credentials", () => {
  it.skipIf(!hasSerpApiKey)("accepts the configured SerpApi key", async () => {
    const response = await fetch(
      `https://serpapi.com/account?api_key=${encodeURIComponent(process.env.SERPAPI_API_KEY!)}`,
    );

    expect(response.ok).toBe(true);
    const body = (await response.json()) as { error?: string; plan_name?: string };
    expect(body.error).toBeUndefined();
    expect(body.plan_name).toBeTruthy();
  }, 15_000);

  it.skipIf(!hasHfToken)("accepts the configured Hugging Face inference token", async () => {
    const response = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
    });

    expect(response.ok).toBe(true);
    const body = (await response.json()) as { name?: string };
    expect(body.name).toBeTruthy();
  });
});
