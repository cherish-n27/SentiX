import React from "react";

type Sentiment = "Positive" | "Neutral" | "Negative";
const sentimentTone: Record<Sentiment, string> = {
  Positive: "border-[#09BF5A]/30 bg-[#09BF5A]/10 text-[#7fefae]",
  Neutral: "border-[#8B93A3]/30 bg-[#8B93A3]/10 text-[#c5cbd5]",
  Negative: "border-[#D82528]/30 bg-[#D82528]/10 text-[#ff9a9c]",
};

export function SentimentBadge({ label, className = "" }: { label: Sentiment; className?: string }) {
  return <span data-sentiment={label.toLowerCase()} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${sentimentTone[label]} ${className}`}>{label}</span>;
}

export function UrgencyBadge({ urgency, className = "" }: { urgency: "High urgency" | "Review soon" | "Monitor"; className?: string }) {
  const tone = urgency === "High urgency" ? "border-[#F8C72D]/30 bg-[#F8C72D]/10 text-[#F8C72D]" : urgency === "Review soon" ? "border-[#D82528]/30 bg-[#D82528]/10 text-[#ff9a9c]" : "border-[#8B93A3]/30 bg-[#8B93A3]/10 text-[#c5cbd5]";
  return <span data-urgency={urgency.toLowerCase().replaceAll(" ", "-")} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${tone} ${className}`}>{urgency}</span>;
}
