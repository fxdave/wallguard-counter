# Makefile & DB Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Makefile` with `install`, `start`, and `import-prod-db` targets, and a script that pulls all Firestore collections from production into the local emulator.

**Architecture:** `Makefile` wraps existing `podman compose` commands. `scripts/import-prod-db.mjs` uses `firebase-admin` (Admin SDK) to read prod Firestore, and the Firebase client SDK connected to the local emulator to write. The emulator's dev rules require auth, so the script creates a temporary user in the Auth emulator before writing.

**Tech Stack:** Node.js ESM, `firebase-admin` (Admin SDK for prod reads), `firebase` client SDK (already a dep — for emulator writes), `podman compose`.

---

### Task 1: Add firebase-admin dev dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /home/arch/wallguard-counter && npm install --save-dev firebase-admin
```

Expected: `package.json` devDependencies gains `"firebase-admin": "^..."`.

- [ ] **Step 2: Verify**

```bash
node -e "import('firebase-admin').then(() => console.log('ok'))"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add firebase-admin dev dependency"
```

---

### Task 2: Create the Makefile

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write the file**

Create `/home/arch/wallguard-counter/Makefile` with this exact content (uses tabs, not spaces):

```makefile
.PHONY: install start import-prod-db

install:
	podman compose build

start:
	podman compose up

import-prod-db:
	node scripts/import-prod-db.mjs
```

- [ ] **Step 2: Verify syntax**

```bash
make --dry-run install
make --dry-run start
make --dry-run import-prod-db
```

Expected: no errors, just prints the commands.

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: add Makefile with install, start, import-prod-db"
```

---

### Task 3: Write the import-prod-db script

**Files:**
- Create: `scripts/import-prod-db.mjs`

- [ ] **Step 1: Write the script**

Create `/home/arch/wallguard-counter/scripts/import-prod-db.mjs`:

```js
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
  setDoc,
  getDocs,
  deleteDoc,
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
```

- [ ] **Step 2: Verify the script parses without syntax errors**

```bash
node --input-type=module < /dev/null && node -e "import('./scripts/import-prod-db.mjs').catch(e => { if (e.message.includes('FIREBASE_SERVICE_ACCOUNT')) process.exit(0); process.exit(1); })"
```

Expected: exits 0 (the env var check fires before any network I/O).

- [ ] **Step 3: Commit**

```bash
git add scripts/import-prod-db.mjs
git commit -m "feat: add import-prod-db script to seed local emulator from prod"
```
