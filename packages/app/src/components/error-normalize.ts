export function normalizeError(input: unknown): Error {
  if (input instanceof Error) return input
  return new Error(typeof input === "string" ? input : JSON.stringify(input))
}
