import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Performs a constant-time comparison between two secret/token strings by hashing both
 * inputs with SHA-256 first so differing lengths do not short-circuit timing checks.
 */
export function timingSafeTokenEqual(
  candidate: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!candidate || !expected) return false;
  const hashA = createHash("sha256").update(candidate, "utf8").digest();
  const hashB = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(hashA, hashB);
}
