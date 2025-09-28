import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum QuoteProvider {
  JUPITER = 'jupiter',
  OKX = 'okx',
}

@Entity('quotes')
@Index(['inputToken', 'outputToken'])
@Index(['provider'])
@Index(['createdAt'])
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'input_token', length: 50 })
  inputToken: string;

  @Column({ name: 'output_token', length: 50 })
  outputToken: string;

  @Column({ name: 'input_amount', type: 'bigint' })
  inputAmount: string;

  @Column({ name: 'output_amount', type: 'bigint' })
  outputAmount: string;

  @Column({ name: 'price_impact_pct', type: 'decimal', precision: 10, scale: 6, nullable: true })
  priceImpactPct?: string;

  @Column({ type: 'enum', enum: QuoteProvider })
  provider: QuoteProvider;

  @Column({ name: 'route_plan', type: 'jsonb' })
  routePlan: any; // Store the complete route plan

  @Column({ name: 'fee_amount', type: 'bigint', nullable: true })
  feeAmount?: string;

  @Column({ name: 'gas_estimate', type: 'bigint', nullable: true })
  gasEstimate?: string;

  @Column({ name: 'response_time_ms', type: 'int' })
  responseTimeMs: number;

  @Column({ name: 'is_cached', type: 'boolean', default: false })
  isCached: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  // Calculated fields for route ranking
  @Column({ name: 'efficiency_score', type: 'decimal', precision: 10, scale: 6, nullable: true })
  efficiencyScore?: string;

  @Column({ name: 'reliability_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  reliabilityScore?: string;
}
