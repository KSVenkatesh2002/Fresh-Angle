import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { getDb } from './client';

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

export async function runMigrations(): Promise<void> {
  console.log('🔄 Running database migrations from ./drizzle...');
  const db = getDb();

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module || process.argv[1]?.includes('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
