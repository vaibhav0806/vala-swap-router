import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SwapStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum SwapProvider {
  JUPITER = 'jupiter',
  OKX = 'okx',
}

@Entity('swap_transactions')
@Index(['userAddress'])
@Index(['status'])
@Index(['provider'])
@Index(['createdAt'])
export class SwapTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_address', length: 50 })
  userAddress: string;

  @Column({ name: 'input_token', length: 50 })
  inputToken: string;

  @Column({ name: 'output_token', length: 50 })
  outputToken: string;

  @Column({ name: 'input_amount', type: 'bigint' })
  inputAmount: string; // Store as string to handle big numbers

  @Column({ name: 'output_amount', type: 'bigint' })
  outputAmount: string;

  @Column({ name: 'min_output_amount', type: 'bigint' })
  minOutputAmount: string;

  @Column({ name: 'slippage_bps', type: 'smallint' })
  slippageBps: number;

  @Column({ type: 'enum', enum: SwapProvider })
  provider: SwapProvider;

  @Column({ type: 'enum', enum: SwapStatus, default: SwapStatus.PENDING })
  status: SwapStatus;

  @Column({ name: 'transaction_hash', length: 100, nullable: true })
  transactionHash?: string;

  @Column({ name: 'route_data', type: 'jsonb' })
  routeData: any; // Store the complete route information

  @Column({ name: 'fee_amount', type: 'bigint', nullable: true })
  feeAmount?: string;

  @Column({ name: 'gas_estimate', type: 'bigint', nullable: true })
  gasEstimate?: string;

  @Column({ name: 'execution_time_ms', type: 'int', nullable: true })
  executionTimeMs?: number;

  @Column({ name: 'error_code', length: 50, nullable: true })
  errorCode?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;
}
