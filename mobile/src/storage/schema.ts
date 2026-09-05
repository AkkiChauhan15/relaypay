import { appSchema, tableSchema } from '@nozbe/watermelondb';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const relayPaySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'wallets',
      columns: [
        { name: 'available_balance_minor', type: 'number' },
        { name: 'locked_balance_minor', type: 'number' },
        { name: 'signing_public_key', type: 'string' },
        { name: 'encryption_public_key', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'nonce', type: 'string', isIndexed: true },
        { name: 'direction', type: 'string' },
        { name: 'sender_public_key', type: 'string', isIndexed: true },
        { name: 'receiver_public_key', type: 'string' },
        { name: 'amount_minor', type: 'number' },
        { name: 'transaction_created_at', type: 'number' },
        { name: 'encrypted_payload', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'recorded_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'seen_nonces',
      columns: [
        { name: 'sender_public_key', type: 'string', isIndexed: true },
        { name: 'nonce', type: 'string', isIndexed: true },
        { name: 'seen_at', type: 'number' },
      ],
    }),
  ],
});

export const relayPayMigrations = schemaMigrations({ migrations: [] });
