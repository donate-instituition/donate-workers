import { Module } from '@nestjs/common';

import { env } from '../config/env';
import { MemoryQueueService } from './memory-queue.service';
import { QUEUE_PORT } from './queue.types';
import { RabbitMqQueueService } from './rabbitmq-queue.service';

@Module({
  providers: [
    MemoryQueueService,
    RabbitMqQueueService,
    {
      provide: QUEUE_PORT,
      useFactory: (
        memoryQueueService: MemoryQueueService,
        rabbitMqQueueService: RabbitMqQueueService,
      ) => {
        if (env.queueProvider === 'rabbitmq') {
          return rabbitMqQueueService;
        }

        if (env.queueProvider === 'memory') {
          return memoryQueueService;
        }

        throw new Error(`Unsupported QUEUE_PROVIDER: ${env.queueProvider}`);
      },
      inject: [MemoryQueueService, RabbitMqQueueService],
    },
  ],
  exports: [QUEUE_PORT, MemoryQueueService, RabbitMqQueueService],
})
export class QueueModule {}
