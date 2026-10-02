import { Module } from '@nestjs/common';
import { SupertokensService } from './supertokens.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  providers: [SupertokensService],
  exports: [SupertokensService],
})
export class AuthModule {}
