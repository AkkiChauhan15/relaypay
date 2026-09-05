import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class SeenNonceModel extends Model {
  static table = 'seen_nonces';

  @field('sender_public_key') senderPublicKey!: string;
  @field('nonce') nonce!: string;
  @field('seen_at') seenAt!: number;
}
