import 'dotenv/config';

type AppEnvironment =
  | 'local'
  | 'development'
  | 'preview'
  | 'production'
  | 'test';

const getNumberEnv = (key: string, fallback: number) => {
  const rawValue = process.env[key]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${key} must be a valid number`);
  }

  return parsedValue;
};

const getStringEnv = (key: string, fallback: string) =>
  process.env[key]?.trim() || fallback;

const getOptionalEnv = (key: string): string | undefined =>
  process.env[key]?.trim() || undefined;

const getBooleanEnv = (key: string, fallback: boolean) => {
  const rawValue = process.env[key]?.trim().toLowerCase();

  if (!rawValue) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'y'].includes(rawValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'n'].includes(rawValue)) {
    return false;
  }

  throw new Error(`${key} must be a valid boolean`);
};

const getAppEnvironment = (): AppEnvironment => {
  const rawValue = (process.env.APP_ENV || process.env.NODE_ENV || 'local')
    .trim()
    .toLowerCase();

  if (rawValue === 'prod') {
    return 'production';
  }

  if (rawValue === 'dev') {
    return 'development';
  }

  if (
    rawValue === 'local' ||
    rawValue === 'development' ||
    rawValue === 'preview' ||
    rawValue === 'production' ||
    rawValue === 'test'
  ) {
    return rawValue;
  }

  return 'local';
};

// Mirrors donate-server's src/config/env.ts Mongo URI resolution exactly —
// both repos must land on the same database.
const defaultMongoDatabaseByEnvironment: Record<AppEnvironment, string> = {
  local: 'test',
  development: 'test',
  preview: 'test',
  production: 'prod',
  test: 'test',
};

const appendMongoDatabase = (clusterUri: string, database: string): string => {
  const normalizedDatabase = database.replace(/^\/+/, '').replace(/\/+$/, '');

  try {
    const url = new URL(clusterUri);
    url.pathname = `/${normalizedDatabase}`;

    return url.toString();
  } catch {
    const queryIndex = clusterUri.indexOf('?');
    const uriWithoutQuery =
      queryIndex >= 0 ? clusterUri.slice(0, queryIndex) : clusterUri;
    const query = queryIndex >= 0 ? clusterUri.slice(queryIndex) : '';

    return `${uriWithoutQuery.replace(/\/+$/, '')}/${normalizedDatabase}${query}`;
  }
};

const appEnvironment = getAppEnvironment();
const mongodbDatabase =
  getOptionalEnv('MONGODB_DATABASE') ||
  defaultMongoDatabaseByEnvironment[appEnvironment];
const mongodbClusterUri =
  getOptionalEnv('MONGODB_CLUSTER_URI') || 'mongodb://127.0.0.1:27017';
const mongodbUri =
  getOptionalEnv('MONGODB_URI') ||
  appendMongoDatabase(mongodbClusterUri, mongodbDatabase);

export const env = {
  appEnvironment,
  emailBrandHeroUrl: getStringEnv('EMAIL_BRAND_HERO_URL', ''),
  emailBrandLogoUrl: getStringEnv('EMAIL_BRAND_LOGO_URL', ''),
  emailDlqName: getStringEnv('EMAIL_DLQ_NAME', 'email.send.dlq'),
  emailFrom: getStringEnv('EMAIL_FROM', 'no-reply@elodoar.local'),
  emailPublicAppUrl: getStringEnv('EMAIL_PUBLIC_APP_URL', ''),
  emailSupportEmail: getStringEnv('EMAIL_SUPPORT_EMAIL', 'contato@elodoar.local'),
  emailSupportPhone: getStringEnv('EMAIL_SUPPORT_PHONE', ''),
  emailProvider: getStringEnv('EMAIL_PROVIDER', 'console'),
  emailQueueName: getStringEnv('EMAIL_QUEUE_NAME', 'email.send'),
  emailRetryInitialDelayMs: getNumberEnv(
    'EMAIL_RETRY_INITIAL_DELAY_MS',
    1_000,
  ),
  emailRetryJitterRatio: getNumberEnv('EMAIL_RETRY_JITTER_RATIO', 0.2),
  emailRetryMaxDelayMs: getNumberEnv('EMAIL_RETRY_MAX_DELAY_MS', 60_000),
  emailRetryMultiplier: getNumberEnv('EMAIL_RETRY_MULTIPLIER', 2),
  emailMaxAttempts: getNumberEnv('EMAIL_MAX_ATTEMPTS', 5),
  fcmEnabled: getBooleanEnv('FCM_ENABLED', true),
  firebaseClientEmail: getStringEnv('FIREBASE_CLIENT_EMAIL', ''),
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '')
    .replace(/\\n/g, '\n')
    .trim(),
  firebaseProjectId: getStringEnv('FIREBASE_PROJECT_ID', ''),
  firebaseServiceAccountJson: getStringEnv('FIREBASE_SERVICE_ACCOUNT_JSON', ''),
  idempotencyProvider: getStringEnv('IDEMPOTENCY_PROVIDER', 'redis'),
  idempotencyTtlMs: getNumberEnv('IDEMPOTENCY_TTL_MS', 24 * 60 * 60 * 1000),
  jwtSecret: getStringEnv('JWT_SECRET', 'dev-secret'),
  mongodbDatabase,
  mongodbUri,
  nodeEnv: getStringEnv('NODE_ENV', 'development'),
  notificationPushDlqName: getStringEnv(
    'NOTIFICATION_PUSH_DLQ_NAME',
    'notification.push.dlq',
  ),
  notificationPushQueueName: getStringEnv(
    'NOTIFICATION_PUSH_QUEUE_NAME',
    'notification.push',
  ),
  objectStorageDriver: getStringEnv('OBJECT_STORAGE_DRIVER', 'local'),
  objectStorageSignedUrlTtlSeconds: getNumberEnv(
    'OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS',
    5 * 60,
  ),
  queueMaxAttempts: getNumberEnv('QUEUE_MAX_ATTEMPTS', 5),
  queueProvider: getStringEnv('QUEUE_PROVIDER', 'memory'),
  queueRetryInitialDelayMs: getNumberEnv(
    'QUEUE_RETRY_INITIAL_DELAY_MS',
    1_000,
  ),
  queueRetryJitterRatio: getNumberEnv('QUEUE_RETRY_JITTER_RATIO', 0.2),
  queueRetryMaxDelayMs: getNumberEnv('QUEUE_RETRY_MAX_DELAY_MS', 60_000),
  queueRetryMultiplier: getNumberEnv('QUEUE_RETRY_MULTIPLIER', 2),
  rabbitmqUrl: getStringEnv(
    'RABBITMQ_URL',
    'amqp://donate:donate@localhost:5672',
  ),
  rabbitmqExchange: getStringEnv('RABBITMQ_EXCHANGE', 'donate.jobs'),
  rabbitmqRetryExchange: getStringEnv(
    'RABBITMQ_RETRY_EXCHANGE',
    'donate.retry',
  ),
  rabbitmqDlxExchange: getStringEnv('RABBITMQ_DLX_EXCHANGE', 'donate.dlx'),
  receiptGenerateDlqName: getStringEnv(
    'RECEIPT_GENERATE_DLQ_NAME',
    'receipt.generate.dlq',
  ),
  receiptGenerateQueueName: getStringEnv(
    'RECEIPT_GENERATE_QUEUE_NAME',
    'receipt.generate',
  ),
  redisKeyPrefix: getStringEnv('REDIS_KEY_PREFIX', 'donate:'),
  redisUrl: getStringEnv('REDIS_URL', 'redis://127.0.0.1:6379'),
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
  s3AccessKeyId: getStringEnv('S3_ACCESS_KEY_ID', ''),
  s3Bucket: getStringEnv('S3_BUCKET', ''),
  s3Endpoint: getStringEnv('S3_ENDPOINT', ''),
  s3ForcePathStyle: getBooleanEnv('S3_FORCE_PATH_STYLE', false),
  s3Region: getStringEnv('S3_REGION', 'us-east-1'),
  s3SecretAccessKey: getStringEnv('S3_SECRET_ACCESS_KEY', ''),
  serviceName: getStringEnv('SERVICE_NAME', 'donate-workers'),
  serviceVersion: getStringEnv(
    'SERVICE_VERSION',
    process.env.npm_package_version || '0.0.1',
  ),
  smtpHost: getStringEnv('SMTP_HOST', 'localhost'),
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpPort: getNumberEnv('SMTP_PORT', 1025),
  smtpSecure: getBooleanEnv('SMTP_SECURE', false),
  smtpUser: process.env.SMTP_USER ?? '',
  stripeCurrency: getStringEnv('STRIPE_CURRENCY', 'brl').toLowerCase(),
  stripeSecretKey: getStringEnv('STRIPE_SECRET_KEY', ''),
  stripeServiceFeeBps: getNumberEnv('STRIPE_SERVICE_FEE_BPS', 0),
  stripeWebhookDlqName: getStringEnv(
    'STRIPE_WEBHOOK_DLQ_NAME',
    'stripe.webhook.dlq',
  ),
  stripeWebhookQueueName: getStringEnv(
    'STRIPE_WEBHOOK_QUEUE_NAME',
    'stripe.webhook',
  ),
  workerName: getStringEnv('WORKER_NAME', 'email'),
};
