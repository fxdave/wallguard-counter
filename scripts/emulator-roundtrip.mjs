// One-off integration smoke test against the Firebase Emulator Suite.
// Signs in (email/password — accepted by the Auth emulator), then exercises the
// real Firestore data model: create category + item, save a checkout, read it
// back via a date-range query. Run with the emulators up:
//   node scripts/emulator-roundtrip.mjs
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-wallguard', apiKey: 'demo-key' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const fail = (m) => {
  console.error('❌', m);
  process.exit(1);
};

const cred = await createUserWithEmailAndPassword(
  auth,
  `dev_${Date.now()}@test.local`,
  'password123',
).catch((e) => fail(`auth failed: ${e.message}`));
console.log('✓ signed in as', cred.user.email);

const catId = (await addDoc(collection(db, 'categories'), { name: 'Drinks', icon: '🥤' })).id;
const itemId = (
  await addDoc(collection(db, 'items'), { name: 'Cola', icon: '🥤', price: 2.5, categoryId: catId })
).id;
console.log('✓ created category + item');

await addDoc(collection(db, 'checkouts'), {
  createdAt: serverTimestamp(),
  total: 5,
  lines: [{ itemId, name: 'Cola', price: 2.5, quantity: 2 }],
});
console.log('✓ saved checkout');

const now = new Date();
const from = new Date(now.getFullYear(), now.getMonth(), 1);
const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
const snap = await getDocs(
  query(
    collection(db, 'checkouts'),
    where('createdAt', '>=', Timestamp.fromDate(from)),
    where('createdAt', '<', Timestamp.fromDate(to)),
    orderBy('createdAt', 'desc'),
  ),
);
const rows = snap.docs.map((d) => d.data());
if (rows.length < 1) fail('range query returned no checkouts');
const line = rows[0].lines[0];
if (line.name !== 'Cola' || line.quantity !== 2) fail('checkout line mismatch');
console.log(`✓ range query returned ${rows.length} checkout(s); line: ${line.name} x${line.quantity}`);

console.log('\n✅ Emulator round-trip OK — auth + Firestore data model + date-range query all work.');
process.exit(0);
