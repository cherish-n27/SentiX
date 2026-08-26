import { invokeLLM } from "./_core/llm";
import type { AnalyzedReview } from "./sentiment";

export type DataCitation = { code: string; reviewId: string; aspect: string; source: string; sentiment: AnalyzedReview["label"] };
export type DataChatReply = { answer: string; citations: DataCitation[]; followUps: string[] };

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
  if (!reviews.length) return { answer: "This workspace has no analyzed reviews yet. Import a document, run a search, or analyze feedback before asking for evidence-based insights.", citations: [], followUps: ["How does SentiX score sentiment?", "What document formats can I import?", "How do I save a workspace?"] };
  const summary = metrics(reviews);
  return { answer: `This workspace contains ${summary.total} analyzed reviews and a Net Sentiment Score of ${summary.nss}%. ${summary.topAspect} is the most represented aspect, with ${summary.negative} negative signal${summary.negative === 1 ? "" : "s"}. I selected the most relevant review evidence for your question below.`, citations: selectCitations(question, reviews), followUps: ["What is driving negative sentiment?", "Which aspect needs attention first?", "Summarize positive service signals"] };
}

export async function answerDataQuestion(question: string, reviews: AnalyzedReview[], history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<DataChatReply> {
  const fallback = fallbackChat(question, reviews);
  if (!reviews.length) return fallback;
  const evidence = reviews.slice(0, 50).map((review, index) => ({ code: `TK-${String(index + 101).padStart(3, "0")}`, text: review.text.slice(0, 900), aspect: review.category, sentiment: review.label, polarity: review.compound, confidence: review.confidence, source: review.source ?? "Direct input" }));
  try {
    const response = await invokeLLM({ model: "gpt-5-mini", maxTokens: 360, messages: [
      { role: "system", content: "You are SentiX, a concise operational sentiment analyst. Use only the supplied active-session metrics and review evidence. Never invent review text, sources, citations, or numbers. State uncertainty when evidence is limited. Keep answers under 150 words." },
      ...history.slice(-6),
      { role: "user", content: `Metrics: ${JSON.stringify(metrics(reviews))}\nEvidence: ${JSON.stringify(evidence)}\n\nQuestion: ${question}` },
    ] });
    const content = response.choices[0]?.message?.content;
    return typeof content === "string" && content.trim() ? { ...fallback, answer: content.trim() } : fallback;
  } catch { return fallback; }
}
