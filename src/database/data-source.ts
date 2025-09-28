import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Token } from './entities/token.entity';
import { SwapTransaction } from './entities/swap-transaction.entity';
import { Quote } from './entities/quote.entity';

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DB_PASSWORD', 'password'),
  database: configService.get('DB_DATABASE', 'vala_swap'),
  entities: [Token, SwapTransaction, Quote],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: configService.get('NODE_ENV') === 'development',
});
