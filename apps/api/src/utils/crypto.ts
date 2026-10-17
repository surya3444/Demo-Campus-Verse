import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(env.ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set');
  }

  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function generateRandomKey(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashSHA256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
