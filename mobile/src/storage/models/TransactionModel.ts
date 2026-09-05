import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

import type {
  TransactionDirection,
  TransactionStatus,
} from '../../domain/types';

export class TransactionModel extends Model {
  static table = 'transactions';

  @field('nonce') nonce!: string;
  @field('direction') direction!: TransactionDirection;
  @field('sender_public_key') senderPublicKey!: string;
  @field('receiver_public_key') receiverPublicKey!: string;
  @field('amount_minor') amountMinor!: number;
  @field('transaction_created_at') transactionCreatedAt!: number;
  @field('encrypted_payload') encryptedPayload!: string;
  @field('status') status!: TransactionStatus;
  @field('recorded_at') recordedAt!: number;
}
