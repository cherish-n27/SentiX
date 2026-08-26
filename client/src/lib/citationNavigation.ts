export type CitableReview = { id: string; text: string; category: string };

export function resolveCitationDestination(reviews: CitableReview[], reviewId: string) {
  const review = reviews.find(item => item.id === reviewId);
  if (!review) return null;
  return { chatOpen: false, tableSearch: review.text, categoryFilter: review.category };
}
