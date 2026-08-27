import { invokeLLM } from "./_core/llm";

const words = (value: string) => value.toLowerCase().match(/[a-z]{4,}/g) ?? [];
const titleCase = (value: string) => value.replace(/\b\w/g, letter => letter.toUpperCase());

export function fallbackWorkbenchName(seed = "", snippets: string[] = []) {
  const text = [seed, ...snippets].join(" ");
  const candidates = ["delivery", "refund", "return", "checkout", "support", "quality", "payment"];
  const topic = candidates.find(candidate => new RegExp(`\\b${candidate}`, "i").test(text));
  if (topic) return `${titleCase(topic)} review analysis`;
  const first = words(seed)[0];
  return first ? `${titleCase(first)} review analysis` : "Customer feedback analysis";
}

export async function suggestWorkbenchName(seed = "", snippets: string[] = []) {
  const fallback = fallbackWorkbenchName(seed, snippets);
  const evidence = [seed, ...snippets].filter(Boolean).join("\n").slice(0, 3_000);
  if (!evidence) return fallback;
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 24,
      messages: [
        { role: "system", content: "Name a customer-feedback analysis workbench. Return only a concise descriptive title of 2 to 6 words. Do not include quotation marks, dates unless present in the evidence, or sensitive customer information." },
        { role: "user", content: evidence },
      ],
    });
    const content = response.choices[0]?.message?.content;
    const title = typeof content === "string" ? content.replace(/["'`\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) : "";
    return title.length >= 2 ? title : fallback;
  } catch { return fallback; }
}
