import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

let s3Client: S3Client | null = null;

// Resolve env values across the supported aliases.
// AWS_S3_REGION / AWS_REGION → region (defaults to us-east-1)
// AWS_S3_BUCKET / AWS_S3_BUCKET_NAME → bucket name
const region = env.AWS_S3_REGION || env.AWS_REGION || 'us-east-1';
const bucket = env.AWS_S3_BUCKET || env.AWS_S3_BUCKET_NAME;

export function getS3Client(): S3Client {
  if (!s3Client) {
    if (!isS3Configured()) {
      throw new Error(
        'S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and either AWS_S3_BUCKET or AWS_S3_BUCKET_NAME'
      );
    }

    const config: ConstructorParameters<typeof S3Client>[0] = {
      region,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    };

    // Custom endpoint for S3-compatible services (Cloudflare R2, MinIO, etc.).
    // An empty AWS_S3_ENDPOINT is ignored so real AWS keeps its default.
    if (env.AWS_S3_ENDPOINT && env.AWS_S3_ENDPOINT.trim().length > 0) {
      config.endpoint = env.AWS_S3_ENDPOINT;
      config.forcePathStyle = env.AWS_S3_FORCE_PATH_STYLE ?? true;
    } else if (env.AWS_S3_FORCE_PATH_STYLE) {
      config.forcePathStyle = true;
    }

    s3Client = new S3Client(config);
  }

  return s3Client;
}

export function getBucketName(): string {
  if (!bucket) {
    throw new Error('S3 bucket name is not configured (set AWS_S3_BUCKET)');
  }
  return bucket;
}

export function isS3Configured(): boolean {
  return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && bucket);
}
