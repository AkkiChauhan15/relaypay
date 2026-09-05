import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { SeenNonceModel } from './models/SeenNonceModel';
import { TransactionModel } from './models/TransactionModel';
import { WalletModel } from './models/WalletModel';
import { relayPayMigrations, relayPaySchema } from './schema';

const adapter = new SQLiteAdapter({
  dbName: 'relaypay',
  jsi: true,
  migrations: relayPayMigrations,
  onSetUpError: error => {
    throw error;
  },
  schema: relayPaySchema,
});

export const database = new Database({
  adapter,
  modelClasses: [WalletModel, TransactionModel, SeenNonceModel],
});
