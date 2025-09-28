import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('tokens')
@Index(['symbol'])
@Index(['chainId'])
export class Token {
  @PrimaryColumn({ length: 50 })
  address: string;

  @Column({ length: 10 })
  symbol: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'smallint' })
  decimals: number;

  @Column({ name: 'chain_id', type: 'int', default: 1 }) // 1 for Solana
  chainId: number;

  @Column({ name: 'logo_uri', length: 500, nullable: true })
  logoURI?: string;

  @Column({ type: 'text', nullable: true })
  tags?: string; // JSON string of tags array

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'daily_volume', type: 'bigint', nullable: true })
  dailyVolume?: string; // Store as string to handle big numbers

  @Column({ name: 'market_cap', type: 'bigint', nullable: true })
  marketCap?: string;

  @Column({ name: 'price_usd', type: 'decimal', precision: 36, scale: 18, nullable: true })
  priceUsd?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
