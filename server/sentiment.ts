import { spawn } from "node:child_process";
import { createRequire } from "node:module";

export type SentimentLabel = "Positive" | "Neutral" | "Negative";

export type ReviewInput = {
  id?: string;
  date?: string;
  text: string;
  author?: string;
  source?: string;
  rating?: number | null;
  category?: string;
  timestamp?: number;
};

export type AnalyzedReview = ReviewInput & {
  id: string;
  label: SentimentLabel;
  compound: number;
  confidence: number;
  category: string;
  vaderCompound: number;
  transformerConfidence: number | null;
  transformerUsed: boolean;
  actionTag: string;
  timestamp: number;
};

type VaderScore = {
  neg: number;
  neu: number;
  pos: number;
  compound: number;
};

const require = createRequire(import.meta.url);
const vaderSentiment = require("vader-sentiment") as { SentimentIntensityAnalyzer: { polarity_scores: (text: string) => VaderScore } };

type TransformerSignal = {
  polarity: number;
  confidence: number;
};

const MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest";
const LOCAL_TERMS: Array<{ term: RegExp; weight: number; category: string }> = [
  { term: /\b(delivery|dispatch|courier|shipment|shipping)\b/i, weight: 0, category: "Delivery" },
  { term: /\b(late|delayed|delay|waiting|waited)\b/i, weight: -0.11, category: "Delivery" },
  { term: /\b(refund|refunded|reimbursement)\b/i, weight: -0.08, category: "Refunds" },
  { term: /\b(return|returned|returns)\b/i, weight: -0.06, category: "Returns" },
  { term: /\b(damaged|broken|faulty|defective)\b/i, weight: -0.15, category: "Product Quality" },
  { term: /\b(robot|bot|automated)\b/i, weight: -0.07, category: "Customer Care" },
  { term: /\b(eish)\b/i, weight: -0.13, category: "Customer Care" },
  { term: /\b(speed|fast|quick|swift|prompt)\b/i, weight: 0.08, category: "Delivery" },
];

const POSITIVE_TERMS = ["fast", "easy", "great", "excellent", "helpful", "quality", "love", "smooth", "quick"];
const NEGATIVE_TERMS = ["late", "refund", "damaged", "return", "robot", "eish", "delay", "broken", "waiting"];

function clamp(value: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function localizedAdjustment(text: string) {
  const matches = LOCAL_TERMS.filter(({ term }) => term.test(text));
  const weight = clamp(matches.reduce((sum, match) => sum + match.weight, 0), -0.28, 0.2);
  const categories = matches.map(match => match.category);
  const category = categories[0] ?? "General Feedback";
  return { weight, category };
}

export function sentimentLabel(compound: number): SentimentLabel {
  if (compound >= 0.18) return "Positive";
  if (compound <= -0.18) return "Negative";
  return "Neutral";
}

export function deriveActionTag(label: SentimentLabel, category: string) {
  if (label === "Positive") return `Protect ${category.toLowerCase()} strength`;
  if (label === "Negative") return `Investigate ${category.toLowerCase()} issue`;
  return `Monitor ${category.toLowerCase()} signals`;
}

export function fallbackVaderScores(texts: string[]): VaderScore[] {
  return texts.map(text => vaderSentiment.SentimentIntensityAnalyzer.polarity_scores(text));
}

export type VaderRuntimeHealth = { mode: "python-nltk-vader" | "javascript-vader-fallback"; detail: string };

export function formatVaderRuntimeHealth(health: VaderRuntimeHealth) {
  return `[Sentiment] VADER runtime: ${health.mode} — ${health.detail}`;
}

export function resolveVaderRuntimeHealth(code: number | null, stderr: string): VaderRuntimeHealth {
  return code === 0
    ? { mode: "python-nltk-vader", detail: "NLTK and the VADER lexicon are ready." }
    : { mode: "javascript-vader-fallback", detail: `Python VADER unavailable (${stderr.trim().split("\n").at(-1) || "unknown error"}); fallback scoring is enabled.` };
}

export function checkVaderRuntime({ spawnProcess = spawn, timeoutMs = 5_000 }: { spawnProcess?: typeof spawn; timeoutMs?: number } = {}): Promise<VaderRuntimeHealth> {
  return new Promise(resolve => {
    const child = spawnProcess("python3", ["scripts/vader_sentiment.py", "--health"], { cwd: process.cwd(), env: { ...process.env, NLTK_DATA: process.env.NLTK_DATA || "/usr/local/nltk_data" } });
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); resolve({ mode: "javascript-vader-fallback", detail: "Python VADER health check timed out; fallback scoring is enabled." }); }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", () => { clearTimeout(timer); resolve({ mode: "javascript-vader-fallback", detail: "Python VADER is unavailable; fallback scoring is enabled." }); });
    child.on("close", (code: number | null) => { clearTimeout(timer); resolve(resolveVaderRuntimeHealth(code, stderr)); });
  });
}

function runVader(texts: string[]): Promise<VaderScore[]> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["scripts/vader_sentiment.py"], { cwd: process.cwd(), env: { ...process.env, NLTK_DATA: process.env.NLTK_DATA || "/usr/local/nltk_data" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        if (/No module named ['\"]nltk['\"]|vader_lexicon[\s\S]*not found|Resource[\s\S]*vader_lexicon/.test(stderr)) {
          resolve(fallbackVaderScores(texts));
          return;
        }
        reject(new Error(`VADER analysis did not complete: ${stderr || "unknown Python error"}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as VaderScore[]);
      } catch {
        reject(new Error("VADER analysis returned an unreadable result."));
      }
    });
    child.stdin.write(JSON.stringify({ texts }));
    child.stdin.end();
  });
}

async function getTransformerSignal(text: string): Promise<TransformerSignal | null> {
  if (!process.env.HF_TOKEN) return null;

  try {
    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${MODEL_ID}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    const candidates = Array.isArray(payload) ? (Array.isArray(payload[0]) ? payload[0] : payload) : [];
    const scores = candidates as Array<{ label?: string; score?: number }>;
    const getScore = (label: string) => scores.find(item => item.label?.toLowerCase() === label)?.score ?? 0;
    const positive = getScore("positive");
    const negative = getScore("negative");
    const neutral = getScore("neutral");
    const confidence = Math.max(positive, negative, neutral);
    if (!confidence) return null;
    return { polarity: clamp(positive - negative), confidence };
  } catch {
    return null;
  }
}

export async function analyzeReviews(inputs: ReviewInput[]): Promise<AnalyzedReview[]> {
  const normalized = inputs
    .map(item => ({ ...item, text: item.text.trim() }))
    .filter(item => item.text.length > 0)
    .slice(0, 100);
  if (normalized.length === 0) return [];

  const vaderScores = await runVader(normalized.map(item => item.text));
  const transformerSignals = await Promise.all(normalized.map(item => getTransformerSignal(item.text)));

  const assignedIds = new Set<string>();
  return normalized.map((item, index) => {
    const vader = vaderScores[index];
    const transformer = transformerSignals[index];
    const local = localizedAdjustment(item.text);
    const compound = clamp(
      vader.compound * (transformer ? 0.5 : 0.85) + (transformer?.polarity ?? 0) * (transformer ? 0.35 : 0) + local.weight,
    );
    const label = sentimentLabel(compound);
    const vaderConfidence = 0.46 + Math.abs(vader.compound) * 0.44;
    const confidence = Math.round((transformer ? vaderConfidence * 0.42 + transformer.confidence * 0.58 : vaderConfidence) * 100);
    const category = item.category || local.category;

    const preferredId = item.id?.trim() || `review-${Date.now()}-${index + 1}`;
    const id = assignedIds.has(preferredId) ? `${preferredId}-${index + 1}` : preferredId;
    assignedIds.add(id);
    return {
      ...item,
      id,
      label,
      compound: Number(compound.toFixed(3)),
      confidence,
      category,
      vaderCompound: Number(vader.compound.toFixed(3)),
      transformerConfidence: transformer ? Math.round(transformer.confidence * 100) : null,
      transformerUsed: Boolean(transformer),
      actionTag: deriveActionTag(label, category),
      timestamp: item.timestamp ?? Date.now() - (normalized.length - index) * 86_400_000,
    };
  });
}

export async function searchReviews(keyword: string): Promise<ReviewInput[]> {
  if (!process.env.SERPAPI_API_KEY) {
    throw new Error("Live search is unavailable until a SerpApi key is configured.");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", keyword);
  url.searchParams.set("api_key", process.env.SERPAPI_API_KEY);
  url.searchParams.set("num", "20");
  const response = await fetch(url);
  if (!response.ok) throw new Error("SerpApi could not complete this search. Try another query.");
  const payload = (await response.json()) as {
    organic_results?: Array<{ title?: string; snippet?: string; link?: string; rating?: number }>;
    local_results?: { places?: Array<{ title?: string; reviews?: number; rating?: number; description?: string }> };
  };
  const organic = (payload.organic_results ?? [])
    .filter(item => item.snippet)
    .map(item => ({
      text: item.snippet!,
      author: item.title ?? "Google result",
      source: item.link ? new URL(item.link).hostname.replace("www.", "") : "Google Search",
      rating: item.rating ?? null,
      category: "Live Search",
    }));
  const local = (payload.local_results?.places ?? [])
    .filter(item => item.description)
    .map(item => ({
      text: item.description!,
      author: item.title ?? "Local result",
      source: "Google Local",
      rating: item.rating ?? null,
      category: "Live Search",
    }));
  return [...organic, ...local].slice(0, 25);
}

function topTerms(reviews: AnalyzedReview[], terms: string[]) {
  return terms
    .map(term => ({ term, mentions: reviews.filter(review => new RegExp(`\\b${term}\\b`, "i").test(review.text)).length }))
    .filter(item => item.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);
}

export function buildInsights(reviews: AnalyzedReview[]) {
  const positive = reviews.filter(review => review.label === "Positive");
  const negative = reviews.filter(review => review.label === "Negative");
  const categoryCounts = reviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.category] = (acc[review.category] ?? 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "General Feedback";
  const positiveTopics = topTerms(positive, POSITIVE_TERMS);
  const negativeTopics = topTerms(negative, NEGATIVE_TERMS);
  const positiveSummary = positiveTopics.length
    ? `Customers most often praise ${positiveTopics.map(item => item.term).join(", ")}.`
    : "No strong positive pattern has been identified yet.";
  const frictionSummary = negativeTopics.length
    ? `The most repeated friction signals are ${negativeTopics.map(item => item.term).join(", ")}.`
    : "No material recurring friction point has been identified yet.";
  return {
    topCategory,
    positiveTopics,
    negativeTopics,
    keyPositives: positiveSummary,
    frictionPoints: frictionSummary,
    recommendations: [
      `Prioritize a review of ${topCategory.toLowerCase()} workflows where negative signals are concentrated.`,
      "Use high-confidence negative comments as a weekly service-recovery queue.",
      "Track the polarity trend after operational interventions to measure improvement.",
    ],
  };
}
