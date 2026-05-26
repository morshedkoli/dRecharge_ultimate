import { hashPassword, verifyPassword } from "./password";

const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  return hashPassword(pin);
}

/**
 * Verify a submitted PIN against the stored bcrypt hash.
 * Plaintext fallback was removed — run scripts/migrate-plaintext-pins.ts
 * once before deploying to convert any legacy rows.
 */
export async function verifyPin(pin: string, storedHash?: string | null): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  if (!storedHash) return false;
  return verifyPassword(pin, storedHash);
}
