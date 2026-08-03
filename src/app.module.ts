import { Module } from '@nestjs/common';

import { EmailModule } from './workers/email/email.module';

@Module({
  imports: [EmailModule],
})
export class AppModule {}
