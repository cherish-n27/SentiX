import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_VERSION = "scrypt-v1";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/** Hash a password with a unique random salt before it reaches persistent storage. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("base64url");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `${HASH_VERSION}$${salt}$${derivedKey.toString("base64url")}`;
}

/** Compare a candidate password in constant time against a stored salted hash. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [version, salt, encodedHash] = storedHash.split("$");
  if (version !== HASH_VERSION || !salt || !encodedHash) return false;

  try {
    const expected = Buffer.from(encodedHash, "base64url");
    const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
  } catch {
    return false;
  }
}
