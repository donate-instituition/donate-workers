# donate-workers

Background workers for the Donate project, implemented with NestJS application
contexts. Workers do not expose HTTP routes; they consume RabbitMQ queues (or
run on a cron schedule) so nothing slow or dependent on an external service
(Stripe, Firebase, the email provider) runs inside a `donate-server` HTTP
request.

## Workers

There are 5 workers. Each can run as its own process (`npm run start:<name>`)
or all together in one process via `WORKER_NAME=all` (`npm run start` /
`start:dev` — the default, handy for local dev so you don't need 5 terminals;
in production each can still scale independently).

| Worker | `WORKER_NAME` | Queue | Trigger |
|---|---|---|---|
| Email | `email` | `email.send` | queue |
| Stripe webhook | `stripe-webhook` | `stripe.webhook` | queue |
| Receipt generate | `receipt-generate` | `receipt.generate` | queue |
| Notification push | `notification-push` | `notification.push` | queue |
| Notification digest | `digest` | — | cron (`DIGEST_CRON_EXPRESSION`, default Monday 9am) |

### Email worker

Consumes `email.send` messages and sends them through the configured email
provider. Use `EMAIL_PROVIDER=smtp` for real SMTP delivery or local Mailpit,
`EMAIL_PROVIDER=console` when you only want structured logs, or
`EMAIL_PROVIDER=resend` for the Resend API.

Message payload:

```json
{
  "idempotencyKey": "email:welcome:user-123",
  "payload": {
    "to": "user@example.com",
    "subject": "Bem-vindo ao Elodoar",
    "text": "Sua conta foi criada.",
    "html": "<p>Sua conta foi criada.</p>",
    "metadata": {
      "userId": "user-123"
    }
  },
  "type": "email.send"
}
```

`idempotencyKey` must be stable for the same logical email. If the same message
is delivered again after it was completed, the worker skips it.

The account creation flow in `donate-server` publishes:

```text
routing key: email.send
idempotencyKey: email:account-created:<userId>
metadata.template: account-created
```

### Stripe webhook worker

Consumes `stripe.webhook`, forwarded here by `donate-server` for every Stripe
event. Updates the matching `Payment`/`Donation`, increments the campaign's
`progress.moneyRaised`/`stats.donationsCount`, invalidates the campaign/
institution Redis cache, and detects when a campaign **crosses its funding
goal** (compares the total before/after the increment, so it doesn't fire
again on every later donation past the goal) — followers of the campaign and
the owning institution get notified when that happens. Publishes the
`receipt.generate` job afterwards.

### Receipt generate worker

Consumes `receipt.generate`. Generates the tax receipt PDF and its DB record,
then publishes the "donation confirmed" push notification and the receipt
email — both gated on the donor's `notifications.donations` preference. The
PDF is written to S3 under
`private/donations/{donationId}/receipts/{file}` (`OBJECT_STORAGE_DRIVER=s3`)
or to `<cwd>/storage/<key>` locally (`OBJECT_STORAGE_DRIVER=local` — only
works if `donate-server` and `donate-workers` share that path/volume).

### Notification push worker

Consumes `notification.push`. Sends via Firebase Admin (FCM) to the user's
active push tokens. Delivery is filtered **by category**: the notification
type (`DONATION_STATUS_UPDATED` / `NEW_MESSAGE` / `CAMPAIGN_GOAL_REACHED`)
maps to the matching preference field (`donations` / `conversations` /
`campaigns`) instead of one global push on/off switch.

### Notification digest worker

Not queue-driven — runs on a cron schedule (`@nestjs/schedule`,
`DIGEST_CRON_EXPRESSION`, default every Monday at 9am). For every user with
`notifications.emailDigestEnabled = true`, sums donations from the last 7
days and sends a summary email (same visual template as the receipt email);
users with no activity that week get nothing. Only runs when
`WORKER_NAME=digest` (or `all`).

## Follow domain

`donate-workers` also has a (reduced) `Follow` schema — just enough to look up
who follows a campaign/institution — because `stripe-webhook` needs it to
decide who to notify when a campaign crosses its funding goal.

## Retry and DLQ

Every queue (`email.send`, `stripe.webhook`, `receipt.generate`,
`notification.push`) uses exponential retry with jitter. `email.send` has its
own `EMAIL_*` policy; the other three share one `QUEUE_*` policy:

```env
EMAIL_MAX_ATTEMPTS=5
EMAIL_RETRY_INITIAL_DELAY_MS=1000
EMAIL_RETRY_MAX_DELAY_MS=60000
EMAIL_RETRY_MULTIPLIER=2
EMAIL_RETRY_JITTER_RATIO=0.2

QUEUE_MAX_ATTEMPTS=5
QUEUE_RETRY_INITIAL_DELAY_MS=1000
QUEUE_RETRY_MAX_DELAY_MS=60000
QUEUE_RETRY_MULTIPLIER=2
QUEUE_RETRY_JITTER_RATIO=0.2
```

When all attempts fail, the message is sent to that queue's DLQ (e.g.
`EMAIL_DLQ_NAME`, `STRIPE_WEBHOOK_DLQ_NAME`, `RECEIPT_GENERATE_DLQ_NAME`,
`NOTIFICATION_PUSH_DLQ_NAME`) instead of being dropped.

## Email provider

Local development should use Mailpit from `donate-infra`:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=no-reply@elodoar.local
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

Mailpit inbox:

```text
http://localhost:8025
```

Production can use any SMTP-compatible provider, including AWS SES SMTP:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=no-reply@your-domain.com
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

## Queue provider

`QUEUE_PROVIDER=rabbitmq` talks to the RabbitMQ instance from `donate-infra`
(see that repo's README for exchanges, retry/DLX setup and production
options). `QUEUE_PROVIDER=memory` is also implemented, for local development
and tests, behind the same queue contract:

- `publish(queueName, message, { delayMs })`
- `subscribe(queueName, handler)`

This keeps worker logic independent from the broker decision.

## Running

```bash
cp .env.example .env
npm install
npm test

# all 5 workers in one process (default for start/start:dev)
npm run start

# or one worker per process
npm run start:email
npm run start:stripe-webhook
npm run start:receipt-generate
npm run start:notification-push
npm run start:digest
```
