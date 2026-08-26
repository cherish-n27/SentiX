export type CitationTarget = { reviewId: string; aspect: string };
export type CitableReview = { id: string; text: string; category: string };

export function getCitationTarget(reviews: CitableReview[], reviewId: string): CitationTarget | null {
  const review = reviews.find(item => item.id === reviewId);
  return review ? { reviewId: review.id, aspect: review.category } : null;
}

export function citationFilterText(reviews: CitableReview[], reviewId: string) {
  return reviews.find(item => item.id === reviewId)?.text ?? "";
}

export function resolveCitationNavigation(reviews: CitableReview[], reviewId: string) {
  const target = getCitationTarget(reviews, reviewId);
  if (!target) return null;
  return {
    chatOpen: false,
    tab: "dashboard" as const,
    tableSearch: citationFilterText(reviews, reviewId),
    sentimentFilter: "All" as const,
    confidenceFilter: "0",
    categoryFilter: target.aspect,
  };
}
