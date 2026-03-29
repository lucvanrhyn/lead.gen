export const optionalContactFallbackProviders = ["snov_io", "hunter"] as const;

export type OptionalContactFallbackProvider =
  (typeof optionalContactFallbackProviders)[number];
