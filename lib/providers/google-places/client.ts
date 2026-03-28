import { CompanyStatus, EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";

const GOOGLE_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_DETAILS_URL = "https://places.googleapis.com/v1";
const SEARCH_FIELD_MASK =
  "places.id,places.name,places.displayName,places.formattedAddress,places.primaryType,places.types,places.rating,places.userRatingCount,places.location,places.googleMapsUri";
const DETAILS_FIELD_MASK =
  "id,name,websiteUri,nationalPhoneNumber,internationalPhoneNumber,formattedAddress,googleMapsUri,displayName,primaryType,types,location,businessStatus";

export type GooglePlacesSearchInput = {
  industry: string;
  region: string;
  maxResults?: number;
  languageCode?: string;
};

type FetchLike = typeof fetch;

type GoogleSearchPlace = {
  id: string;
  name: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

type GoogleSearchResponse = {
  places?: GoogleSearchPlace[];
};

type GoogleDetailsPlace = {
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
  displayName?: { text?: string };
  primaryType?: string;
  types?: string[];
  location?: {
    latitude?: number;
    longitude?: number;
  };
  businessStatus?: string;
};

export type NormalizedGooglePlaceCandidate = {
  externalId: string;
  resourceName: string;
  name: string;
  website?: string;
  phone?: string;
  formattedAddress?: string;
  primaryType?: string;
  types: string[];
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  businessStatus?: string;
  confidence: number;
  raw: {
    search: GoogleSearchPlace;
    details?: GoogleDetailsPlace;
  };
};

export function buildGooglePlacesTextSearchRequest({
  industry,
  region,
  maxResults = 10,
  languageCode = "en",
}: GooglePlacesSearchInput) {
  const textQuery = `${industry.trim()} in ${region.trim()}`;
  const pageSize = Math.max(1, Math.min(maxResults, 20));

  return {
    textQuery,
    maxResultCount: pageSize,
    languageCode,
    pageSize,
  };
}

function getGoogleMapsApiKey(apiKey?: string) {
  const resolved = apiKey ?? process.env.GOOGLE_MAPS_API_KEY;

  if (!resolved) {
    throw new Error("Google Maps API key is required for Google Places discovery.");
  }

  return resolved;
}

async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  fetchFn: FetchLike,
  attempts = 3,
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchFn(url, init);

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`Google Places request failed with status ${response.status}.`);
      continue;
    }

    throw new Error(`Google Places request failed with status ${response.status}.`);
  }

  throw lastError ?? new Error("Google Places request failed after retries.");
}

export function normalizeGooglePlaceCandidate({
  searchPlace,
  detailPlace,
}: {
  searchPlace: GoogleSearchPlace;
  detailPlace?: GoogleDetailsPlace;
}): NormalizedGooglePlaceCandidate {
  const completenessSignals = [
    searchPlace.displayName?.text,
    detailPlace?.websiteUri,
    detailPlace?.nationalPhoneNumber ?? detailPlace?.internationalPhoneNumber,
    searchPlace.formattedAddress ?? detailPlace?.formattedAddress,
    searchPlace.primaryType ?? detailPlace?.primaryType,
    searchPlace.googleMapsUri ?? detailPlace?.googleMapsUri,
  ].filter(Boolean).length;

  const confidence = Number(Math.min(0.95, 0.45 + completenessSignals * 0.08).toFixed(2));

  return {
    externalId: searchPlace.id,
    resourceName: searchPlace.name,
    name: searchPlace.displayName?.text ?? detailPlace?.displayName?.text ?? "Unknown company",
    website: detailPlace?.websiteUri,
    phone: detailPlace?.nationalPhoneNumber ?? detailPlace?.internationalPhoneNumber,
    formattedAddress: searchPlace.formattedAddress ?? detailPlace?.formattedAddress,
    primaryType: searchPlace.primaryType ?? detailPlace?.primaryType,
    types: searchPlace.types ?? detailPlace?.types ?? [],
    rating: searchPlace.rating,
    reviewCount: searchPlace.userRatingCount,
    latitude: searchPlace.location?.latitude ?? detailPlace?.location?.latitude,
    longitude: searchPlace.location?.longitude ?? detailPlace?.location?.longitude,
    googleMapsUrl: searchPlace.googleMapsUri ?? detailPlace?.googleMapsUri,
    businessStatus: detailPlace?.businessStatus,
    confidence,
    raw: {
      search: searchPlace,
      details: detailPlace,
    },
  };
}

async function fetchPlaceDetails(
  resourceName: string,
  apiKey: string,
  fetchFn: FetchLike,
) {
  return fetchJsonWithRetry(
    `${GOOGLE_PLACES_DETAILS_URL}/${resourceName}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    },
    fetchFn,
  ) as Promise<GoogleDetailsPlace>;
}

export async function searchGooglePlaces(
  input: GooglePlacesSearchInput,
  options?: {
    apiKey?: string;
    fetchFn?: FetchLike;
    persist?: boolean;
  },
) {
  const apiKey = getGoogleMapsApiKey(options?.apiKey);
  const fetchFn = options?.fetchFn ?? fetch;
  const requestBody = buildGooglePlacesTextSearchRequest(input);

  const searchResponse = (await fetchJsonWithRetry(
    GOOGLE_PLACES_SEARCH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    },
    fetchFn,
  )) as GoogleSearchResponse;

  const candidates = await Promise.all(
    (searchResponse.places ?? []).map(async (place) => {
      try {
        const detailPlace = await fetchPlaceDetails(place.name, apiKey, fetchFn);

        return normalizeGooglePlaceCandidate({
          searchPlace: place,
          detailPlace,
        });
      } catch {
        return normalizeGooglePlaceCandidate({
          searchPlace: place,
        });
      }
    }),
  );

  if (options?.persist !== false) {
    await persistGooglePlacesResults(candidates, input);
  }

  return {
    provider: "google_places",
    request: requestBody,
    candidates,
  };
}

export async function persistGooglePlacesResults(
  candidates: NormalizedGooglePlaceCandidate[],
  input: GooglePlacesSearchInput,
) {
  const { db } = await import("@/lib/db");
  const persisted = [];

  for (const candidate of candidates) {
    const company = await db.company.upsert({
      where: {
        googlePlaceId: candidate.externalId,
      },
      create: {
        name: candidate.name,
        website: candidate.website,
        normalizedDomain: candidate.website
          ? new URL(candidate.website).hostname.replace(/^www\./, "")
          : null,
        industry: input.industry,
        locationSummary: candidate.formattedAddress ?? input.region,
        googlePlaceId: candidate.externalId,
        status: CompanyStatus.DISCOVERED,
        sourceConfidence: candidate.confidence,
      },
      update: {
        name: candidate.name,
        website: candidate.website,
        normalizedDomain: candidate.website
          ? new URL(candidate.website).hostname.replace(/^www\./, "")
          : null,
        industry: input.industry,
        locationSummary: candidate.formattedAddress ?? input.region,
        sourceConfidence: candidate.confidence,
        status: CompanyStatus.DISCOVERED,
      },
    });

    const existingPrimaryLocation = await db.companyLocation.findFirst({
      where: {
        companyId: company.id,
        isPrimary: true,
      },
    });

    if (candidate.latitude && candidate.longitude) {
      if (existingPrimaryLocation) {
        await db.companyLocation.update({
          where: { id: existingPrimaryLocation.id },
          data: {
            label: candidate.formattedAddress ?? input.region,
            city: input.region,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          },
        });
      } else {
        await db.companyLocation.create({
          data: {
            companyId: company.id,
            label: candidate.formattedAddress ?? input.region,
            city: input.region,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            isPrimary: true,
          },
        });
      }
    }

    await db.sourceEvent.create({
      data: {
        companyId: company.id,
        provider: SourceProvider.GOOGLE_PLACES,
        eventType: "google_places.discovery",
        fieldName: "company.discovery",
        sourceUrl: candidate.googleMapsUrl,
        confidence: candidate.confidence,
        payload: candidate.raw,
      },
    });

    await db.enrichmentJob.create({
      data: {
        companyId: company.id,
        provider: SourceProvider.GOOGLE_PLACES,
        stage: EnrichmentStage.GOOGLE_PLACES_DISCOVERY,
        status: JobStatus.SUCCEEDED,
        attempts: 1,
        requestedBy: "api.discovery.search",
        resultSummary: {
          discovered_name: candidate.name,
          google_place_id: candidate.externalId,
        },
      },
    });

    persisted.push(company);
  }

  return persisted;
}
