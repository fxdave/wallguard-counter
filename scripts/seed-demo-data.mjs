// Fill the local emulator with a year of plausible activity — enough data for
// the README screenshots and for eyeballing the Overview and Stats pages.
//
//   node scripts/seed-demo-data.mjs            # seeds, keeps existing data
//   node scripts/seed-demo-data.mjs --email me@example.com
//
// The emulators must be up (`make start`). It also creates the sign-in user
// (email/password, accepted by the Auth emulator) and allowlists it.
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

const emailArg = process.argv.indexOf('--email');
const EMAIL = emailArg > -1 ? process.argv[emailArg + 1] : 'demo@wallguard.local';
const PASSWORD = 'password123';

const app = initializeApp({ projectId: 'demo-wallguard', apiKey: 'demo-key' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD).catch(() =>
  signInWithEmailAndPassword(auth, EMAIL, PASSWORD),
);
await setDoc(doc(db, 'members', EMAIL.toLowerCase()), {
  addedBy: 'seed',
  addedAt: Timestamp.now(),
});

const CATEGORIES = [
  { id: 'drinks', name: 'Drinks', icon: '🥤', order: 1000 },
  { id: 'food', name: 'Food', icon: '🍔', order: 2000 },
  { id: 'snacks', name: 'Snacks', icon: '🍿', order: 3000 },
  { id: 'passes', name: 'Passes', icon: '🎫', order: 4000 },
];

// `weight` only steers the generator — it is not part of the data model.
const ITEMS = [
  { id: 'beer', name: 'Beer', icon: '🍺', price: 800, categoryId: 'drinks', weight: 10 },
  { id: 'wine', name: 'Wine', icon: '🍷', price: 1200, categoryId: 'drinks', weight: 4 },
  { id: 'coffee', name: 'Coffee', icon: '☕', price: 600, categoryId: 'drinks', weight: 12 },
  { id: 'soda', name: 'Soda', icon: '🥫', price: 450, categoryId: 'drinks', weight: 7 },
  { id: 'water', name: 'Water', icon: '💧', price: 300, categoryId: 'drinks', weight: 8 },
  { id: 'burger', name: 'Burger', icon: '🍔', price: 2600, categoryId: 'food', weight: 6 },
  { id: 'fries', name: 'Fries', icon: '🍟', price: 1100, categoryId: 'food', weight: 7 },
  { id: 'sandwich', name: 'Sandwich', icon: '🥪', price: 1500, categoryId: 'food', weight: 5 },
  { id: 'soup', name: 'Soup', icon: '🍲', price: 1300, categoryId: 'food', weight: 3 },
  { id: 'chips', name: 'Chips', icon: '🥔', price: 550, categoryId: 'snacks', weight: 6 },
  { id: 'chocolate', name: 'Chocolate', icon: '🍫', price: 700, categoryId: 'snacks', weight: 4 },
  { id: 'peanuts', name: 'Peanuts', icon: '🥜', price: 500, categoryId: 'snacks', weight: 3 },
  { id: 'icecream', name: 'Ice cream', icon: '🍦', price: 900, categoryId: 'snacks', weight: 3 },
];

const PASS_ITEMS = [
  { id: 'gym', name: 'Gym pass', icon: '🏋️', price: 1800, categoryId: 'passes', weight: 5 },
  { id: 'sauna', name: 'Sauna pass', icon: '🧖', price: 2400, categoryId: 'passes', weight: 3 },
];

const DISCOUNTS = [
  { id: 'member', name: 'Member', percent: 10, order: 1000 },
  { id: 'happy-hour', name: 'Happy hour', percent: 20, order: 2000 },
  { id: 'staff', name: 'Staff', percent: 50, order: 3000 },
];

const HOLDERS = [
  'Anna Kovács', 'Béla Nagy', 'Csilla Tóth', 'Dávid Szabó', 'Eszter Horváth',
  'Ferenc Varga', 'Gábor Kiss', 'Hanna Molnár', 'István Németh', 'Júlia Farkas',
];

// Deterministic PRNG so re-seeding produces the same screenshots.
let seed = 20260910;
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const round2 = (n) => Math.round(n * 100) / 100;

function weightedPick(pool) {
  const total = pool.reduce((sum, i) => sum + i.weight, 0);
  let roll = random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}

async function commitAll(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    for (const write of writes.slice(i, i + 400)) write(batch);
    await batch.commit();
  }
}

// ---------------------------------------------------------------- catalogue

await commitAll([
  ...CATEGORIES.map((c) => (batch) => batch.set(doc(db, 'categories', c.id), {
    name: c.name,
    icon: c.icon,
    order: c.order,
  })),
  ...[...ITEMS, ...PASS_ITEMS].map((item, i) => (batch) =>
    batch.set(doc(db, 'items', item.id), {
      name: item.name,
      icon: item.icon,
      price: item.price,
      categoryId: item.categoryId,
      order: (i + 1) * 1000,
      ...(PASS_ITEMS.includes(item) ? { isPass: true, canExpire: false } : {}),
    }),
  ),
  ...DISCOUNTS.map((d) => (batch) => batch.set(doc(db, 'discounts', d.id), {
    name: d.name,
    percent: d.percent,
    order: d.order,
  })),
  ...HOLDERS.flatMap((name, i) =>
    PASS_ITEMS.map((pass) => (batch) =>
      batch.set(doc(collection(db, 'passHolders')), {
        name,
        birthday: `19${between(70, 99)}-0${between(1, 9)}-1${between(0, 9)}`,
        startedAt: '2026-01-05',
        passItemId: pass.id,
        createdAt: Timestamp.fromDate(new Date(2026, 0, 5 + i)),
        usageCount: between(1, 20),
      }),
    ),
  ),
]);

// ---------------------------------------------------------------- checkouts

const START = new Date(2026, 0, 1);
const END = new Date();
const checkoutWrites = [];
let checkoutCount = 0;

for (let day = new Date(START); day <= END; day.setDate(day.getDate() + 1)) {
  const weekday = day.getDay();
  const weekend = weekday === 0 || weekday === 6;
  // Weekends are busier, and the place slowly grows through the year.
  const growth = 1 + (day.getMonth() / 11) * 0.6;
  const base = weekend ? between(6, 14) : between(2, 8);
  const perDay = weekday === 1 ? Math.round(base * 0.5) : Math.round(base * growth);

  for (let n = 0; n < perDay; n++) {
    const at = new Date(day);
    at.setHours(between(8, 21), between(0, 59), 0, 0);

    const lines = [];
    for (let l = 0; l < between(1, 4); l++) {
      const item = weightedPick(random() < 0.12 ? PASS_ITEMS : ITEMS);
      if (lines.some((line) => line.itemId === item.id)) continue;

      if (PASS_ITEMS.includes(item)) {
        // A known holder counts at 0; an unknown visitor pays full price.
        const known = random() < 0.7;
        lines.push({
          itemId: item.id,
          name: item.name,
          price: known ? 0 : item.price,
          quantity: 1,
          holderName: pick(HOLDERS),
          holderBirthday: '1990-01-01',
        });
      } else {
        lines.push({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: between(1, 4),
        });
      }
    }

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

    // Discounts stack multiplicatively, each line holding its own reduction.
    let running = subtotal;
    if (random() < 0.22 && subtotal > 0) {
      const applied = DISCOUNTS.filter(() => random() < 0.4);
      for (const discount of applied.length ? applied : [DISCOUNTS[0]]) {
        const cut = round2(running * (discount.percent / 100));
        running = round2(running - cut);
        lines.push({
          itemId: discount.id,
          name: discount.name,
          price: -cut,
          quantity: 1,
          percent: discount.percent,
        });
      }
    }

    checkoutCount++;
    checkoutWrites.push((batch) =>
      batch.set(doc(collection(db, 'checkouts')), {
        createdAt: Timestamp.fromDate(at),
        total: round2(running),
        lines,
      }),
    );
  }
}

await commitAll(checkoutWrites);

console.log(`✅ seeded ${checkoutCount} checkouts`);
console.log(`   sign in with ${EMAIL} / ${PASSWORD}`);
process.exit(0);
