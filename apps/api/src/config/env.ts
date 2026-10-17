import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().default('http://localhost:3000'), // Comma-separated for multiple origins
  API_URL: z.string().default('http://localhost:3001'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/campus_verse'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  // Sliding inactivity window for a login session: the refresh token (and its
  // cookie) are rotated on every use, so a session only ends after this much
  // continuous inactivity.
  JWT_REFRESH_EXPIRY: z.string().default('90d'),

  // AWS / S3
  // Both AWS_REGION and the more descriptive AWS_S3_REGION are accepted; the
  // resolver below picks whichever is set. Same story for the bucket name.
  AWS_REGION: z.string().optional(),
  AWS_S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  // Custom S3 endpoint (Cloudflare R2 / MinIO). Empty string = use real AWS.
  AWS_S3_ENDPOINT: z.string().optional(),
  AWS_S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  // SMS Gateway
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().default('CAMPUS'),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Campus Verse <campusverse@chiranjeeb.dev>'),
  SUPER_ADMIN_EMAIL: z.string().default('campusverse@chiranjeeb.dev'),

  // Encryption
  ENCRYPTION_KEY: z.string().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // LiveKit (live classes)
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  // S3 bucket for room-composite egress recordings. If unset, recordings are
  // disabled — startRecording() will reject with RECORDING_NOT_CONFIGURED.
  LIVEKIT_RECORDING_S3_BUCKET: z.string().optional(),

  // OpenAI (AI-assisted bulk upload mapping + the AI Assistant chat). Optional —
  // when unset the /students/bulk-upload/ai-parse and /ai/chat endpoints return
  // 503; the rest of the app continues to work.
  OPENAI_API_KEY: z.string().min(1).optional(),
  // Default model for the AI Assistant chat loop. gpt-4o-mini is cheap and
  // handles most lookups; the "complex" model is reserved for harder multi-step
  // reasoning if/when the service decides to escalate.
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_CHAT_MODEL_COMPLEX: z.string().default('gpt-4o'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.'));
      console.error('Missing or invalid environment variables:', missingVars);
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }
    throw error;
  }
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
