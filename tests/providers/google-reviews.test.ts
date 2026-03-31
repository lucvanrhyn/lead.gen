import { fetchGoogleReviews, type GoogleReview } from "@/lib/providers/google-reviews";

function mockFetchOk(data: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as typeof fetch;
}

function mockFetchError(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
  }) as unknown as typeof fetch;
}

describe("fetchGoogleReviews", () => {
  it("returns normalized reviews on success", async () => {
    const apiResponse = {
      reviews: [
        {
          authorAttribution: { displayName: "Jane Doe" },
          rating: 4,
          text: { text: "Great service, friendly staff." },
          relativePublishTimeDescription: "2 weeks ago",
        },
        {
          authorAttribution: { displayName: "John Smith" },
          rating: 2,
          text: { text: "Very slow, waited 45 minutes." },
          relativePublishTimeDescription: "1 month ago",
        },
      ],
    };

    const reviews = await fetchGoogleReviews("place_abc", {
      apiKey: "test-key",
      fetchFn: mockFetchOk(apiResponse),
    });

    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toEqual({
      author: "Jane Doe",
      rating: 4,
      text: "Great service, friendly staff.",
      relativeTime: "2 weeks ago",
    });
    expect(reviews[1]).toEqual({
      author: "John Smith",
      rating: 2,
      text: "Very slow, waited 45 minutes.",
      relativeTime: "1 month ago",
    });
  });

  it("limits to 5 reviews when API returns more", async () => {
    const reviews = Array.from({ length: 8 }, (_, i) => ({
      authorAttribution: { displayName: `User ${i}` },
      rating: 3,
      text: { text: `Review ${i}` },
      relativePublishTimeDescription: "1 day ago",
    }));

    const result = await fetchGoogleReviews("place_xyz", {
      apiKey: "test-key",
      fetchFn: mockFetchOk({ reviews }),
    });

    expect(result).toHaveLength(5);
  });

  it("returns empty array when API returns no reviews", async () => {
    const result = await fetchGoogleReviews("place_empty", {
      apiKey: "test-key",
      fetchFn: mockFetchOk({}),
    });

    expect(result).toEqual([]);
  });

  it("returns empty array on HTTP error (does not throw)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchGoogleReviews("place_fail", {
      apiKey: "test-key",
      fetchFn: mockFetchError(500),
    });

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[google-reviews]"),
    );

    warnSpy.mockRestore();
  });

  it("returns empty array on network error (does not throw)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwingFetch = vi.fn().mockRejectedValue(new Error("Network timeout")) as unknown as typeof fetch;

    const result = await fetchGoogleReviews("place_timeout", {
      apiKey: "test-key",
      fetchFn: throwingFetch,
    });

    expect(result).toEqual([]);
    warnSpy.mockRestore();
  });

  it("returns empty array when apiKey is empty", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;

    const result = await fetchGoogleReviews("place_no_key", {
      apiKey: "",
      fetchFn,
    });

    expect(result).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns empty array when placeId is empty", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;

    const result = await fetchGoogleReviews("", {
      apiKey: "test-key",
      fetchFn,
    });

    expect(result).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("handles missing author gracefully", async () => {
    const result = await fetchGoogleReviews("place_anon", {
      apiKey: "test-key",
      fetchFn: mockFetchOk({
        reviews: [
          {
            rating: 5,
            text: { text: "Nice!" },
            relativePublishTimeDescription: "3 days ago",
          },
        ],
      }),
    });

    expect(result[0].author).toBe("Anonymous");
  });

  it("sends correct headers and URL", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reviews: [] }),
    }) as unknown as typeof fetch;

    await fetchGoogleReviews("ChIJtest123", {
      apiKey: "my-api-key",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/ChIJtest123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "my-api-key",
          "X-Goog-FieldMask": expect.stringContaining("reviews"),
        }),
      }),
    );
  });
});
