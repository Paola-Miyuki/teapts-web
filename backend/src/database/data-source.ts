import { existsSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getDatabaseOptions } from './database.config';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource({
  ...getDatabaseOptions(new ConfigService()),
});
