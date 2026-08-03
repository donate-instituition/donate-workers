# donate-workers

Background workers for the Donate project, implemented with NestJS application
contexts. Workers do not expose HTTP routes; they boot providers and subscribe
to queues.

## Workers

### Email worker

Consumes `email.send` messages and sends them through the configured email
provider. Use `EMAIL_PROVIDER=smtp` for real SMTP delivery or local Mailpit, and
`EMAIL_PROVIDER=console` when you only want structured logs.

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

## Retry and DLQ

Workers use exponential retry with jitter:

```env
EMAIL_MAX_ATTEMPTS=5
EMAIL_RETRY_INITIAL_DELAY_MS=1000
EMAIL_RETRY_MAX_DELAY_MS=60000
EMAIL_RETRY_MULTIPLIER=2
EMAIL_RETRY_JITTER_RATIO=0.2
```

When all attempts fail, the message is sent to `EMAIL_DLQ_NAME`.

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

`QUEUE_PROVIDER=memory` is implemented for local development and tests.

Kafka/RabbitMQ should be added as adapters behind the same queue contract:

- `publish(queueName, message, { delayMs })`
- `subscribe(queueName, handler)`

This keeps worker logic independent from the broker decision.

## Running

```bash
cp .env.example .env
npm install
npm test
npm run start:email
```
