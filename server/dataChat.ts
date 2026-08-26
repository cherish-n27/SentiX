import { invokeLLM } from "./_core/llm";
import type { AnalyzedReview } from "./sentiment";

export type DataCitation = {
  code: string;
  reviewId: string;
  aspect: string;
  source: string;
  sentiment: AnalyzedReview["label"];
};

export type DataChatReply = {
  answer: string;
  citations: DataCitation[];
  followUps: string[];
};

type DataChatHistory = Array<{ role: "user" | "assistant"; content: string }>;

function getMetrics(reviews: AnalyzedReview[]) {
  const positive = reviews.filter(review => review.label === "Positive").length;
  const negative = reviews.filter(review => review.label === "Negative").length;
  const categories = reviews.reduce<Record<string, number>>((total, review) => ({ ...total, [review.category]: (total[review.category] ?? 0) + 1 }), {});
  const topAspect = Object.entries(categories).sort(([, left], [, right]) => right - left)[0]?.[0] ?? "General Feedback";
  return { total: reviews.length, positive, negative, nss: reviews.length ? Math.round(((positive - negative) / reviews.length) * 100) : 0, topAspect };
}

function matchingReviews(question: string, reviews: AnalyzedReview[]) {
  const terms = question.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const scored = reviews.map((review, index) => ({
    review,
    index,
    score: terms.reduce((score, term) => score + (review.text.toLowerCase().includes(term) || review.category.toLowerCase().includes(term) || review.actionTag.toLowerCase().includes(term) ? 3 : 0), 0) + review.confidence / 100,
  }));
  return scored.sort((left, right) => right.score - left.score).slice(0, 3);
}

export function selectDataCitations(question: string, reviews: AnalyzedReview[]): DataCitation[] {
  return matchingReviews(question, reviews).map(({ review, index }) => ({
    code: `TK-${String(index + 101).padStart(3, "0")}`,
    reviewId: review.id,
    aspect: review.category,
    source: review.source ?? "Direct input",
    sentiment: review.label,
  }));
}

export function buildDataChatFallback(question: string, reviews: AnalyzedReview[]): DataChatReply {
  if (!reviews.length) {
    return {
      answer: "There is no active feedback in this workspace yet. Import a document, search for reviews, or analyze a feedback snippet, then ask me to identify patterns or risks.",
      citations: [],
      followUps: ["What should I import?", "How is sentiment scored?", "What makes a good review dataset?"],
    };
  }
  const metrics = getMetrics(reviews);
  const citations = selectDataCitations(question, reviews);
  const negativeSignal = metrics.negative ? `${metrics.negative} negative signal${metrics.negative === 1 ? "" : "s"}` : "no negative signals";
  return {
    answer: `The active workspace contains ${metrics.total} analyzed review${metrics.total === 1 ? "" : "s"}, with a Net Sentiment Score of ${metrics.nss}%. The dominant aspect is ${metrics.topAspect}, and the dataset currently shows ${negativeSignal}. The cited references are the most relevant evidence for your question.`,
    citations,
    followUps: ["What is driving negative sentiment?", "Which aspect needs attention first?", "Summarize positive service signals"],
  };
}

export async function answerDataQuestion(question: string, reviews: AnalyzedReview[], history: DataChatHistory = []): Promise<DataChatReply> {
  const fallback = buildDataChatFallback(question, reviews);
  if (!reviews.length) return fallback;

  const metrics = getMetrics(reviews);
  const evidence = reviews.slice(0, 50).map((review, index) => ({
    code: `TK-${String(index + 101).padStart(3, "0")}`,
    text: review.text.slice(0, 900),
    source: review.source ?? "Direct input",
    aspect: review.category,
    sentiment: review.label,
    polarity: review.compound,
    confidence: review.confidence,
  }));
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 360,
      messages: [
        { role: "system", content: "You are SentiX, a concise sentiment intelligence analyst. Answer only from the supplied session metrics and review evidence. Do not invent customer feedback, percentages, sources, or review codes. State uncertainty when evidence is thin. Keep the answer under 150 words and practical for an operations leader." },
        ...history.slice(-6).map(item => ({ role: item.role, content: item.content })),
        { role: "user", content: `Active session metrics: ${JSON.stringify(metrics)}\nReview evidence: ${JSON.stringify(evidence)}\n\nQuestion: ${question}` },
      ],
    });
    const rawAnswer = response.choices[0]?.message?.content;
    const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
    return answer ? { ...fallback, answer } : fallback;
  } catch {
    return fallback;
  }
}
