/**
 * Single, consistent Indian mobile number validation utility.
 *
 * Rules:
 * - Empty/null/undefined is considered valid ONLY when optional is true (or when evaluating whether a non-empty value passes).
 * - Exactly 10 digits.
 * - Leading digit must be 6, 7, 8, or 9.
 * - Rejects alphabets, special characters, whitespace, fewer or more than 10 digits.
 * - Whitespace is trimmed first.
 */

export const INDIAN_MOBILE_ERROR_MESSAGE = "Please enter a valid 10-digit mobile number.";

export const INDIAN_MOBILE_PLACEHOLDER = "9876543210";

/**
 * Validates whether a given phone string is a valid 10-digit Indian mobile number.
 * If optional is true, an empty/null/whitespace-only input returns true.
 * If a non-empty string is provided, it must strictly match ^[6-9]\d{9}$.
 */
export function isValidIndianMobileNumber(phone: string | null | undefined, optional: boolean = false): boolean {
  if (phone === null || phone === undefined) {
    return optional;
  }

  const trimmed = String(phone).trim();
  if (trimmed === "") {
    return optional;
  }

  // Exactly 10 digits starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(trimmed);
}
