import { invokeLLM } from "./_core/llm";
import type { AnalyzedReview } from "./sentiment";

export type DataCitation = { code: string; reviewId: string; aspect: string; source: string; sentiment: AnalyzedReview["label"] };
export type DataChatReply = { answer: string; citations: DataCitation[]; followUps: string[] };

const PRODUCT_GLOSSARY: Array<{ terms: string[]; answer: string }> = [
  { terms: ["net sentiment", "sentiment health", "nss"], answer: "Net Sentiment Score is the percentage of positive reviews minus the percentage of negative reviews in the active workbench. It ranges from -100% to +100%; neutral reviews affect the denominator but do not add or subtract from the score." },
  { terms: ["customer volume", "volume trend", "review volume"], answer: "Customer Volume Trend compares the count of reviews dated in the current seven-day window with the preceding seven-day window. It is a volume signal, not a satisfaction score." },
  { terms: ["confidence", "average confidence"], answer: "Average confidence is the mean confidence of the active workbench’s classifications. It reflects scoring certainty and should be considered alongside the source quality and review volume." },
  { terms: ["sentiment breakout", "positive vs", "distribution"], answer: "Sentiment breakout shows the number of positive, neutral, and negative reviews. Positive vs. negative displays the corresponding shares of all reviews in the active workbench." },
  { terms: ["polarity trend", "trend chart"], answer: "Polarity Trend plots the blended sentiment polarity for reviews ordered by their review timestamp. It shows the sequence of available evidence and is not a forecast." },
  { terms: ["engine breakdown", "vader", "hugging face", "hf engine"], answer: "Engine Breakdown displays the JavaScript VADER polarity, Hugging Face model confidence where available, and the final blended classification. Aspect labels are derived from SentiX’s transparent service-term rules rather than hidden review rewriting." },
  { terms: ["export report", "csv", "pdf report"], answer: "Export report provides an enriched CSV of the active workbench’s classified reviews and a PDF executive report summarizing its metrics, evidence, and recommendations." },
];

export function answerProductQuestion(question: string): DataChatReply | null {
  const query = question.toLowerCase();
  const entry = PRODUCT_GLOSSARY.find(item => item.terms.some(term => query.includes(term)));
  return entry ? { answer: entry.answer, citations: [], followUps: ["What is Net Sentiment Score?", "How does Engine Breakdown work?", "What does the polarity trend show?"] } : null;
}

function metrics(reviews: AnalyzedReview[]) {
  const positive = reviews.filter(review => review.label === "Positive").length;
  const negative = reviews.filter(review => review.label === "Negative").length;
  const categories = reviews.reduce<Record<string, number>>((all, review) => ({ ...all, [review.category]: (all[review.category] ?? 0) + 1 }), {});
  return { total: reviews.length, positive, negative, nss: reviews.length ? Math.round((positive - negative) / reviews.length * 100) : 0, topAspect: Object.entries(categories).sort(([, left], [, right]) => right - left)[0]?.[0] ?? "General Feedback" };
}

export function selectCitations(question: string, reviews: AnalyzedReview[]): DataCitation[] {
  const terms = question.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return reviews.map((review, index) => ({ review, index, score: terms.reduce((score, term) => score + (review.text.toLowerCase().includes(term) || review.category.toLowerCase().includes(term) ? 3 : 0), 0) + review.confidence / 100 }))
    .sort((left, right) => right.score - left.score).slice(0, 3)
    .map(({ review, index }) => ({ code: `TK-${String(index + 101).padStart(3, "0")}`, reviewId: review.id, aspect: review.category, source: review.source ?? "Direct input", sentiment: review.label }));
}

export function fallbackChat(question: string, reviews: AnalyzedReview[]): DataChatReply {
  if (!reviews.length) return { answer: "This workbench has no analyzed reviews yet. Import a document, run a search, or analyze feedback before asking for evidence-based insights.", citations: [], followUps: ["How does SentiX score sentiment?", "What document formats can I import?", "How do I start a workbench?"] };
  const summary = metrics(reviews);
  return { answer: `This workbench contains ${summary.total} analyzed reviews and a Net Sentiment Score of ${summary.nss}%. ${summary.topAspect} is the most represented aspect, with ${summary.negative} negative signal${summary.negative === 1 ? "" : "s"}. I selected the most relevant review evidence for your question below.`, citations: selectCitations(question, reviews), followUps: ["What is driving negative sentiment?", "Which aspect needs attention first?", "Summarize positive service signals"] };
}

export async function answerDataQuestion(question: string, reviews: AnalyzedReview[], history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<DataChatReply> {
  const productAnswer = answerProductQuestion(question);
  if (productAnswer) return productAnswer;
  const fallback = fallbackChat(question, reviews);
  if (!reviews.length) return fallback;
  const evidence = reviews.slice(0, 50).map((review, index) => ({ code: `TK-${String(index + 101).padStart(3, "0")}`, text: review.text.slice(0, 900), aspect: review.category, sentiment: review.label, polarity: review.compound, confidence: review.confidence, source: review.source ?? "Direct input" }));
  try {
    const response = await invokeLLM({ model: "gpt-5-mini", maxTokens: 360, messages: [
      { role: "system", content: "You are SentiX, a concise operational sentiment analyst. Use only the supplied active-session metrics and review evidence. Never invent review text, sources, citations, or numbers. State uncertainty when evidence is limited. For questions about app metrics, charts, engines, or reports, explain their documented definitions without pretending they are review evidence. Keep answers under 150 words." },
      ...history.slice(-6),
      { role: "user", content: `Metrics: ${JSON.stringify(metrics(reviews))}\nEvidence: ${JSON.stringify(evidence)}\n\nQuestion: ${question}` },
    ] });
    const content = response.choices[0]?.message?.content;
    return typeof content === "string" && content.trim() ? { ...fallback, answer: content.trim() } : fallback;
  } catch { return fallback; }
}
