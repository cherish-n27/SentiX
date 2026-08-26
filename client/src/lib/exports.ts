export type ExportableReview = {
  source?: string;
  author?: string;
  text: string;
  label: string;
  compound: number;
  confidence: number;
  category: string;
  actionTag: string;
  timestamp: number;
};

export type ExecutiveInsights = {
  keyPositives?: string;
  frictionPoints?: string;
  recommendations?: string[];
};

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export function buildEnrichedCsv(reviews: ExportableReview[]) {
  const header = "source,author,review_text,sentiment_label,compound_polarity,confidence_percent,category,action_tag,timestamp";
  const rows = reviews.map(review => [
    review.source ?? "",
    review.author ?? "",
    review.text,
    review.label,
    review.compound,
    review.confidence,
    review.category,
    review.actionTag,
    new Date(review.timestamp).toISOString(),
  ].map(csvCell).join(","));
  return [header, ...rows].join("\n");
}

export function buildExecutiveReportSections(total: number, nss: number, insights?: ExecutiveInsights) {
  return [
    ["Analysis scope", `${total} analyzed review${total === 1 ? "" : "s"} · Net Sentiment Score: ${Math.round(nss)}%`],
    ["Key positives", insights?.keyPositives ?? "Preparing evidence summary…"],
    ["Critical friction points", insights?.frictionPoints ?? "Preparing evidence summary…"],
    ["Actionable recommendations", insights?.recommendations?.map(item => `• ${item}`).join("\n") ?? "Preparing evidence summary…"],
  ] as const;
}
