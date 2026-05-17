import { hashPassword, verifyPassword } from "./password";

const PIN_PATTERN = /^\d{4,6}$/;
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  return hashPassword(pin);
}

export async function verifyPin(
  pin: string,
  storedHash?: string | null,
  legacyPlaintext?: string | null
): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  if (storedHash) return verifyPassword(pin, storedHash);
  if (!legacyPlaintext) return false;
  if (BCRYPT_PATTERN.test(legacyPlaintext)) return verifyPassword(pin, legacyPlaintext);
  return legacyPlaintext === pin;
}

