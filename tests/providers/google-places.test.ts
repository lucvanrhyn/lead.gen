import {
  buildGooglePlacesTextSearchRequest,
  normalizeGooglePlaceCandidate,
  searchGooglePlaces,
} from "@/lib/providers/google-places/client";

describe("buildGooglePlacesTextSearchRequest", () => {
  it("builds a text query from industry and region", () => {
    expect(
      buildGooglePlacesTextSearchRequest({
        industry: "Dental Clinics",
        region: "Cape Town, South Africa",
        maxResults: 5,
      }),
    ).toEqual({
      textQuery: "Dental Clinics in Cape Town, South Africa",
      maxResultCount: 5,
      languageCode: "en",
      pageSize: 5,
    });
  });
});

describe("normalizeGooglePlaceCandidate", () => {
  it("merges search and detail responses into a normalized lead candidate", () => {
    const normalized = normalizeGooglePlaceCandidate({
      searchPlace: {
        id: "place_123",
        name: "places/place_123",
        displayName: { text: "Atlas Dental Group" },
        formattedAddress: "12 Loop St, Cape Town, South Africa",
        primaryType: "dentist",
        types: ["dentist", "health"],
        rating: 4.6,
        userRatingCount: 118,
        googleMapsUri: "https://maps.google.com/?cid=atlas",
        location: { latitude: -33.9249, longitude: 18.4241 },
      },
      detailPlace: {
        websiteUri: "https://atlasdental.co.za",
        nationalPhoneNumber: "+27 21 555 0133",
      },
    });

    expect(normalized).toMatchObject({
      externalId: "place_123",
      name: "Atlas Dental Group",
      website: "https://atlasdental.co.za",
      phone: "+27 21 555 0133",
      primaryType: "dentist",
    });
    expect(normalized.confidence).toBeGreaterThan(0.7);
  });
});

describe("searchGooglePlaces", () => {
  it("throws when the API key is missing", async () => {
    await expect(
      searchGooglePlaces(
        {
          industry: "Dental Clinics",
          region: "Cape Town, South Africa",
        },
        {
          apiKey: "",
          fetchFn: vi.fn(),
        },
      ),
    ).rejects.toThrow(/google maps api key/i);
  });
});
