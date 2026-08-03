import 'dotenv/config';

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

export const env = {
  emailDlqName: getStringEnv('EMAIL_DLQ_NAME', 'email.send.dlq'),
  emailFrom: getStringEnv('EMAIL_FROM', 'no-reply@elodoar.local'),
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
  nodeEnv: getStringEnv('NODE_ENV', 'development'),
  queueProvider: getStringEnv('QUEUE_PROVIDER', 'memory'),
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
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
  smtpHost: getStringEnv('SMTP_HOST', 'localhost'),
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpPort: getNumberEnv('SMTP_PORT', 1025),
  smtpSecure: getBooleanEnv('SMTP_SECURE', false),
  smtpUser: process.env.SMTP_USER ?? '',
  workerName: getStringEnv('WORKER_NAME', 'email'),
};
