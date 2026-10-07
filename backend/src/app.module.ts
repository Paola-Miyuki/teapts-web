import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { getDatabaseOptions } from './database/database.config';
import { HealthModule } from './health/health.module';
import { ProfessionalsModule } from './professionals/professionals.module';

/**
 * Módulo raiz: configura o banco de dados e reúne os módulos da API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...getDatabaseOptions(configService),
        autoLoadEntities: true,
      }),
    }),

    AccountsModule,
    AuthModule,
    HealthModule,
    ProfessionalsModule,
  ],
})
export class AppModule {}
