import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupertokensService } from './supertokens.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [AuthController],
  providers: [SupertokensService],
})
export class AuthModule {}
