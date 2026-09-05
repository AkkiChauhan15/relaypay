import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class WalletModel extends Model {
  static table = 'wallets';

  @field('available_balance_minor') availableBalanceMinor!: number;
  @field('locked_balance_minor') lockedBalanceMinor!: number;
  @field('signing_public_key') signingPublicKey!: string;
  @field('encryption_public_key') encryptionPublicKey!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
}
