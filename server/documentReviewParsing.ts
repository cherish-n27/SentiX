export type DocumentReviewRecord = {
  id: string;
  date?: string;
  source: string;
  text: string;
  author?: string;
  rating?: number | null;
  category?: string;
  timestamp?: number;
};

type HuggingFaceChatResponse = { choices?: Array<{ message?: { content?: string } }> };
const EXTRACTION_MODEL = "Qwen/Qwen2.5-7B-Instruct-1M";

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "sentix_document_reviews",
    strict: true,
    schema: {
      type: "object",
      properties: {
        reviews: {
          type: "array",
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              date: { type: "string" },
              source: { type: "string" },
              text: { type: "string" },
              author: { type: "string" },
              rating: { type: ["number", "null"] },
              category: { type: "string" },
            },
            required: ["id", "date", "source", "text", "author", "rating", "category"],
            additionalProperties: false,
          },
        },
      },
      required: ["reviews"],
      additionalProperties: false,
    },
  },
};

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const timestampFor = (date: string) => {
  if (!date) return undefined;
  const numeric = Number(date);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
};
const generatedId = (source: string, position: number) => `${source.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "document"}-${position + 1}`;

export function normalizeDocumentReviewRecords(payload: unknown, source: string): DocumentReviewRecord[] {
  const candidates = payload && typeof payload === "object" && Array.isArray((payload as { reviews?: unknown[] }).reviews) ? (payload as { reviews: unknown[] }).reviews : [];
  const ids = new Set<string>();
  return candidates.reduce<DocumentReviewRecord[]>((records, candidate, index) => {
    if (!candidate || typeof candidate !== "object") return records;
    const item = candidate as Record<string, unknown>;
    const text = clean(item.text);
    if (!text) return records;
    const initialId = clean(item.id) || generatedId(source, index);
    const id = ids.has(initialId) ? `${initialId}-${index + 1}` : initialId;
    ids.add(id);
    const date = clean(item.date);
    const rating = item.rating === null ? null : typeof item.rating === "number" && Number.isFinite(item.rating) ? item.rating : null;
    records.push({ id, date: date || undefined, source: clean(item.source) || source, text, author: clean(item.author) || undefined, rating, category: clean(item.category) || undefined, timestamp: timestampFor(date) });
    return records;
  }, []);
}

export async function extractDocumentReviews(text: string, source: string, fetchImpl: typeof fetch = fetch): Promise<DocumentReviewRecord[]> {
  if (!process.env.HF_TOKEN) throw new Error("AI document parsing is unavailable until the Hugging Face token is configured.");
  const response = await fetchImpl("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0,
      max_tokens: 8_000,
      response_format: responseFormat,
      messages: [
        { role: "system", content: "Extract customer reviews into structured records. A review is an atomic customer feedback item, never a sentence fragment. Preserve every review's original wording exactly in text. Put identifiers, dates, platforms, and names in their dedicated fields; never copy metadata labels or values into text. Use explicit review separators, line breaks, repeated ID/date patterns, and layout cues to find review boundaries. Do not use commas, periods, or other ordinary sentence punctuation as review boundaries. If no reliable boundary exists, emit one whole-document review rather than splitting it." },
        { role: "user", content: `Source document: ${source}\n\nExtracted text:\n${text.slice(0, 60_000)}` },
      ],
    }),
  });
  if (!response.ok) throw new Error("AI document parsing could not identify review records. Please try a clearer source document.");
  const payload = await response.json() as HuggingFaceChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI document parsing returned no structured review records.");
  try {
    const reviews = normalizeDocumentReviewRecords(JSON.parse(content), source);
    if (!reviews.length) throw new Error("No complete review records could be identified in this document.");
    return reviews;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("AI document parsing returned an unreadable result.");
    throw error;
  }
}
