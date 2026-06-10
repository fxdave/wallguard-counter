/**
 * Firestore migration runner.
 *
 * Reads FIREBASE_SERVICE_ACCOUNT (JSON string) and FIREBASE_PROJECT_ID from env.
 * Discovers all migrations/*.mjs files, runs pending ones in order, and records
 * each applied migration in the `_migrations` Firestore collection.
 *
 * Usage (prod):
 *   FIREBASE_SERVICE_ACCOUNT="..." FIREBASE_PROJECT_ID="wallguard-counter" \
 *   node scripts/migrate.mjs
 *
 * Usage (emulator, for testing):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_SERVICE_ACCOUNT='{"project_id":"demo-wallguard","type":"service_account","private_key":"x","client_email":"x@x.x"}' \
 *   FIREBASE_PROJECT_ID=demo-wallguard \
 *   node scripts/migrate.mjs
 */

import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}');
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('FIREBASE_PROJECT_ID must be set.');
  process.exit(1);
}

let credential;
// When using the emulator with a fake SA, cert() will fail — fall back to
// application default (which the emulator accepts without validation).
try {
  credential = cert(sa);
} catch {
  credential = applicationDefault();
}

initializeApp({ credential, projectId });
const db = getFirestore();

const migrationsDir = join(process.cwd(), 'migrations');
let files;
try {
  files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.mjs'))
    .sort();
} catch {
  console.log('No migrations directory found — nothing to run.');
  process.exit(0);
}

if (files.length === 0) {
  console.log('No migration files found — nothing to run.');
  process.exit(0);
}

const appliedSnap = await db.collection('_migrations').get();
const applied = new Set(appliedSnap.docs.map((d) => d.id));

let ran = 0;
for (const file of files) {
  const id = file.replace('.mjs', '');
  if (applied.has(id)) {
    console.log(`  skip  ${id}`);
    continue;
  }
  console.log(`  run   ${id} …`);
  const { run } = await import(pathToFileURL(join(migrationsDir, file)).href);
  await run(db);
  await db
    .collection('_migrations')
    .doc(id)
    .set({ appliedAt: FieldValue.serverTimestamp() });
  console.log(`  done  ${id}`);
  ran++;
}

console.log(`\n${ran} migration(s) applied.`);
