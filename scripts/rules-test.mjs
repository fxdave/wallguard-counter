// Security-rules test for the PRODUCTION firestore.rules, run against the
// already-running Firestore emulator under a throwaway project namespace
// (does not touch the app's dev data). Verifies the dynamic email allowlist:
//
//   node scripts/rules-test.mjs
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'wallguard-rules-test',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// Start from a clean slate for this project namespace.
await env.clearFirestore();

const ctx = (email, verified = true) =>
  env
    .authenticatedContext(email.replace(/\W/g, '_'), {
      email,
      email_verified: verified,
    })
    .firestore();

const owner = ctx('dbiro97@gmail.com'); // hardcoded bootstrap owner in rules
const rando = ctx('rando@example.com'); // signed in but NOT allowlisted
const unverified = ctx('dbiro97@gmail.com', false); // owner email, unverified

let passed = 0;
const check = async (label, p) => {
  await p;
  passed++;
  console.log('  ✓', label);
};

console.log('Production rules — access control:');

// Owner bootstrap works with no member document.
await check('owner can write app data', assertSucceeds(setDoc(doc(owner, 'categories/c1'), { name: 'Drinks', icon: '🥤' })));
await check('owner can read app data', assertSucceeds(getDoc(doc(owner, 'categories/c1'))));

// Non-member is locked out of everything.
await check('non-member denied reading data', assertFails(getDoc(doc(rando, 'categories/c1'))));
await check('non-member denied writing data', assertFails(setDoc(doc(rando, 'categories/c2'), { name: 'X', icon: 'x' })));
await check('non-member denied reading members', assertFails(getDoc(doc(rando, 'members/x@example.com'))));
await check('non-member denied adding themselves', assertFails(setDoc(doc(rando, 'members/rando@example.com'), { addedBy: 'self' })));

// Unverified email is rejected even if it matches the owner.
await check('unverified email denied', assertFails(getDoc(doc(unverified, 'categories/c1'))));

// Owner adds a member -> that member gains access.
await check('owner can add a member', assertSucceeds(setDoc(doc(owner, 'members/bob@example.com'), { addedBy: 'owner@example.com' })));
const bob = ctx('bob@example.com');
await check('new member can read data', assertSucceeds(getDoc(doc(bob, 'categories/c1'))));
await check('new member can manage members (flat model)', assertSucceeds(setDoc(doc(bob, 'members/carol@example.com'), { addedBy: 'bob@example.com' })));

// Mixed-case email still matches (rules lowercase the token email).
const bobUpper = ctx('Bob@Example.com');
await check('mixed-case member email still allowed', assertSucceeds(getDoc(doc(bobUpper, 'categories/c1'))));

// Pass holders are gated like the rest of the app data.
await check('member can register a pass holder', assertSucceeds(setDoc(doc(bob, 'passHolders/h1'), { name: 'Ada', birthday: '1990-01-01', passItemId: 'p1' })));
await check('member can read pass holders', assertSucceeds(getDoc(doc(bob, 'passHolders/h1'))));
await check('non-member denied pass holders', assertFails(getDoc(doc(rando, 'passHolders/h1'))));

await env.cleanup();
console.log(`\n✅ All ${passed} rule assertions passed — dynamic allowlist enforced correctly.`);
process.exit(0);
