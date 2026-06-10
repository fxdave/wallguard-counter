/**
 * Imports all Firestore data from production into the local emulator.
 *
 * Requires:
 *   FIREBASE_SERVICE_ACCOUNT — JSON string of the prod service account key
 *   FIREBASE_PROJECT_ID      — prod project ID (e.g. wallguard-counter)
 *
 * Emulator must be running on localhost:8080 (auth on 9099).
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT="$(cat firebase-sa.json)" \
 *   FIREBASE_PROJECT_ID=wallguard-counter \
 *   node scripts/import-prod-db.mjs
 */

import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const COLLECTIONS = [
  'categories',
  'items',
  'checkouts',
  'members',
  'passHolders',
  '_migrations',
];

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}');
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!sa.project_id || !projectId) {
  console.error('FIREBASE_SERVICE_ACCOUNT and FIREBASE_PROJECT_ID must be set.');
  process.exit(1);
}

// --- Read from prod via Admin SDK ---
admin.initializeApp({ credential: admin.credential.cert(sa), projectId });
const prodDb = admin.firestore();

console.log('Reading prod collections…');
const allDocs = {};
for (const col of COLLECTIONS) {
  const snap = await prodDb.collection(col).get();
  allDocs[col] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`  ${col}: ${allDocs[col].length} docs`);
}

// --- Write to local emulator via client SDK ---
const emuApp = initializeApp(
  { projectId: 'demo-wallguard', apiKey: 'demo-key' },
  'emu',
);
const emuAuth = getAuth(emuApp);
const emuDb = getFirestore(emuApp);
connectAuthEmulator(emuAuth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(emuDb, 'localhost', 8080);

// Authenticate against emulator (dev rules require request.auth != null).
const tempEmail = 'import-script@dev.local';
const tempPass = 'import-script-pass';
try {
  await signInWithEmailAndPassword(emuAuth, tempEmail, tempPass);
} catch {
  await createUserWithEmailAndPassword(emuAuth, tempEmail, tempPass);
}

console.log('\nWriting to emulator…');
for (const col of COLLECTIONS) {
  const docs = allDocs[col];
  if (docs.length === 0) {
    console.log(`  ${col}: nothing to import`);
    continue;
  }

  // Delete existing emulator docs first.
  const existingSnap = await getDocs(collection(emuDb, col));
  const deleteBatch = writeBatch(emuDb);
  existingSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  // Write prod docs in batches of 400 (Firestore limit is 500 per batch).
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = writeBatch(emuDb);
    for (const { id, data } of chunk) {
      // Convert Admin SDK Timestamps to client SDK-compatible plain objects.
      const converted = convertTimestamps(data);
      batch.set(doc(collection(emuDb, col), id), converted);
    }
    await batch.commit();
  }
  console.log(`  ${col}: ${docs.length} docs imported`);
}

console.log('\nDone.');

/**
 * Recursively converts firebase-admin Timestamp instances to ISO strings so
 * the client SDK can store them as plain string fields. (The client SDK will
 * store them as-is; this avoids cross-SDK Timestamp incompatibility.)
 */
function convertTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertTimestamps(v)]),
    );
  }
  return obj;
}
