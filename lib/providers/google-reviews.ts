/**
 * Google Places API (New) — Review fetching.
 *
 * Uses the same API key and fetch pattern as google-places/client.ts.
 * Returns structured review data for a given placeId; never throws —
 * returns an empty array on failure so reviews remain a "nice to have".
 */

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const REVIEWS_FIELD_MASK = "reviews.authorAttribution,reviews.rating,reviews.text,reviews.relativePublishTimeDescription,reviews.publishTime";

export type GoogleReview = {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
};

type PlaceReviewsResponse = {
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
  }>;
};

function normalizeReview(raw: NonNullable<PlaceReviewsResponse["reviews"]>[number]): GoogleReview {
  return {
    author: raw.authorAttribution?.displayName ?? "Anonymous",
    rating: raw.rating ?? 0,
    text: raw.text?.text ?? "",
    relativeTime: raw.relativePublishTimeDescription ?? "",
  };
}

export async function fetchGoogleReviews(
  placeId: string,
  opts: { apiKey: string; fetchFn?: typeof fetch },
): Promise<GoogleReview[]> {
  const { apiKey, fetchFn = fetch } = opts;

  if (!apiKey || !placeId) {
    return [];
  }

  try {
    const url = `${GOOGLE_PLACES_BASE_URL}/places/${placeId}`;
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": REVIEWS_FIELD_MASK,
      },
    });

    if (!response.ok) {
      console.warn(
        `[google-reviews] Failed to fetch reviews for placeId=${placeId}: HTTP ${response.status}`,
      );
      return [];
    }

    const data = (await response.json()) as PlaceReviewsResponse;
    const reviews = (data.reviews ?? []).slice(0, 5).map(normalizeReview);
    return reviews;
  } catch (error) {
    console.warn(
      `[google-reviews] Error fetching reviews for placeId=${placeId}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
