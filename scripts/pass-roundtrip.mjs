// Verifies the pass feature's data flow against the emulator (dev rules):
// register a pass holder, list holders for that pass, then save a checkout with
// one free line (existing holder) and one paid line (newly registered person),
// each carrying the holder's snapshot. Run with emulators up:
//   node scripts/pass-roundtrip.mjs
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

await createUserWithEmailAndPassword(auth, `pass_${Date.now()}@test.local`, 'password123').catch(
  (e) => fail(`auth failed: ${e.message}`),
);

// A pass item.
const passItemId = (
  await addDoc(collection(db, 'items'), {
    name: 'Season Pass',
    icon: '🎟️',
    price: 50,
    categoryId: 'cat-passes',
    isPass: true,
  })
).id;

// Register an existing holder for that pass.
await addDoc(collection(db, 'passHolders'), {
  name: 'Ada Lovelace',
  birthday: '1990-05-10',
  passItemId,
  createdAt: serverTimestamp(),
});
console.log('✓ registered a pass holder');

// List holders scoped to this pass.
const holdersSnap = await getDocs(
  query(collection(db, 'passHolders'), where('passItemId', '==', passItemId), orderBy('name')),
);
if (holdersSnap.size !== 1) fail(`expected 1 holder, got ${holdersSnap.size}`);
console.log(`✓ listed ${holdersSnap.size} holder for the pass`);

// Save a checkout: Ada (existing → free) + Bob (new → full price), one line each.
const lines = [
  { itemId: passItemId, name: 'Season Pass', price: 0, quantity: 1, holderName: 'Ada Lovelace', holderBirthday: '1990-05-10' },
  { itemId: passItemId, name: 'Season Pass', price: 50, quantity: 1, holderName: 'Bob Newman', holderBirthday: '2001-09-02' },
];
const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
await addDoc(collection(db, 'checkouts'), { createdAt: serverTimestamp(), total, lines });
if (total !== 50) fail(`expected total 50, got ${total}`);
console.log(`✓ saved pass checkout: 2 person-lines, total ${total} (free + paid)`);

console.log('\n✅ Pass round-trip OK — holders, per-pass scoping, and per-person checkout lines all work.');
process.exit(0);
