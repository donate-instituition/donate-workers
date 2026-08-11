# donate-workers — Relatório do que está implementado

> Referência de apoio à monografia, gerada a partir de auditoria direta do
> código em 2026-08-11. Para a visão do sistema como um todo (os 4
> repositórios juntos), ver `donate-infra/RELATORIO-TCC.md`.

## O que é este repositório

Processamento assíncrono do EloDoar: NestJS rodando como *application
context* (sem servidor HTTP), consumindo filas RabbitMQ e um job por cron.
Existe para que nada lento ou dependente de serviço externo (Stripe,
Firebase, provedor de e-mail) rode dentro do tempo de resposta de uma
requisição do `donate-server` — se o Stripe demorar ou o provedor de
e-mail cair, a fila apenas acumula e reprocessa, a API principal continua
respondendo normalmente.

## Os 5 workers

Cada um roda como processo dedicado via `WORKER_NAME=<nome>`, **ou** todos
juntos num único processo via `WORKER_NAME=all` (`npm run start` —
conveniência adicionada nesta sessão para não precisar abrir 5 terminais
em desenvolvimento local; em produção cada um continua podendo escalar
como processo independente).

1. **stripe-webhook** (fila `stripe.webhook`) — processa cada evento do
   Stripe recebido pelo `donate-server`: atualiza `Payment`/`Donation`,
   incrementa `progress.moneyRaised`/`stats.donationsCount` da campanha,
   invalida cache Redis de campanha/instituição, detecta quando uma
   campanha **cruza a meta de arrecadação** (compara o valor antes/depois
   do incremento — não dispara de novo a cada doação subsequente que já
   passou da meta) e notifica quem segue a campanha e a instituição dona.
   Publica em seguida o job de geração de recibo.
2. **receipt-generate** (fila `receipt.generate`) — gera o PDF do recibo
   fiscal e o registro correspondente; publica a notificação push "doação
   confirmada" e o e-mail de recibo, ambos condicionados à preferência
   `notifications.donations` do doador (um único campo controla os dois
   canais). O PDF é gravado no S3 sob
   `private/donations/{donationId}/receipts/{arquivo}` (antes desta sessão
   era uma chave achatada `receipts/{ano}/{institutionId}/{arquivo}`, sem
   a hierarquia `public/`/`private/` usada pelo resto do sistema) — o
   `donate-server` não precisou mudar nada para ler a chave nova, já que só
   lê `receipt.metadata.storageObjectKey`, seja lá o que estiver ali.
3. **notification-push** (fila `notification.push`) — envia via Firebase
   Admin (FCM) para os tokens de push ativos do usuário. O envio é
   filtrado **por categoria**: o tipo da notificação
   (`DONATION_STATUS_UPDATED`/`NEW_MESSAGE`/`CAMPAIGN_GOAL_REACHED`) é
   mapeado para o campo de preferência correspondente
   (`donations`/`conversations`/`campaigns`) em vez de um único
   interruptor global de push.
4. **notification-digest** (cron, não fila) — `@nestjs/schedule`
   (dependência nova, não havia biblioteca de cron no projeto antes),
   expressão configurável via `DIGEST_CRON_EXPRESSION` (padrão: toda
   segunda 9h). Para cada usuário com `notifications.emailDigestEnabled =
   true`, soma as doações dos últimos 7 dias e envia um e-mail-resumo
   (mesmo template visual do recibo); usuário sem atividade na semana não
   recebe nada.
5. **email** (fila `email.send`) — provedores plugáveis: SMTP, Resend, ou
   console (para dev local via Mailpit).

## Retry e dead-letter queue

Toda fila usa retry exponencial com jitter (parâmetros configuráveis por
fila via env: `*_MAX_ATTEMPTS`, `*_RETRY_INITIAL_DELAY_MS`,
`*_RETRY_MAX_DELAY_MS`, `*_RETRY_MULTIPLIER`, `*_RETRY_JITTER_RATIO`).
Depois de esgotadas as tentativas, a mensagem vai para `<fila>.dlq` em vez
de ser descartada silenciosamente.

## Follow — domínio novo neste repositório

Até esta sessão, `donate-workers` não tinha nenhuma noção de "seguir"
(quem segue uma campanha ou instituição) — foi adicionado (schema
reduzido, só o necessário para a notificação de meta atingida) porque o
worker `stripe-webhook` precisa consultar isso para saber quem notificar.

## Trabalho mais recente (sessão atual)

1. **Filtragem de push por categoria** — antes, `PushNotificationsService.
   sendToUser` checava um único campo `notifications.push` para qualquer
   tipo de notificação. Agora mapeia o tipo da notificação para a
   categoria certa antes de decidir se envia.
2. **Notificação de meta de campanha atingida** — recurso novo do zero:
   detecção do cruzamento de meta em `stripe-webhook-handler.service.ts`,
   domínio `Follow` trazido para este repositório, tipo de notificação
   `CAMPAIGN_GOAL_REACHED` adicionado.
3. **Resumo semanal por e-mail** — worker novo (`notification-digest`),
   primeira vez que o projeto usa um agendador cron real (antes só existia
   `setInterval` cru para o flush de contadores no `donate-server`, que
   não é adequado para "uma vez por semana, sobrevivendo a reinícios").
4. **`WORKER_NAME=all`** — cada um dos 5 workers já tinha seu próprio
   auto-bloqueio (`if (env.workerName !== '<nome>') return`); foi
   generalizado para um helper `isWorkerEnabled(name)` que também aceita
   `WORKER_NAME=all`, então um único processo local roda tudo.
5. Consolidação do envio de recibo (push + e-mail) para depender de um
   único campo `notifications.donations`, em vez de dois campos separados
   `push`/`email` que existiam antes.
6. **Chave do recibo fiscal migrada para a hierarquia `private/` do S3**
   (`private/donations/{donationId}/receipts/{arquivo}`), parte da
   persistência real no S3 feita nesta rodada (avatares, logos, capas,
   comprovantes, recibos) — ver `donate-infra/RELATORIO-TCC.md` para a
   visão completa da arquitetura de storage.

## Ressalva sobre a documentação já existente no repositório

`README.md` documenta só o worker de e-mail — não menciona
`stripe-webhook`, `receipt-generate`, `notification-push` nem
`notification-digest`, que já existiam ou foram adicionados depois da
última atualização do arquivo. Não foi alterado — este relatório é um
arquivo novo e independente.
