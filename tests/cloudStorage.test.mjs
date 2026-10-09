import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const sdkUrl = url("export let rows = {}; export let writes = []; export let lastQuery = null; export let listener = null; export let transactionCount = 0;\nexport function reset(next = {}) { rows = { ...next }; writes = []; transactionCount = 0; }\nexport const collection = (_db, ...path) => ({ path: path.join('/') });\nexport const doc = (_db, ...path) => ({ path: path.join('/'), id: path.at(-1) });\nexport const serverTimestamp = () => ({ seconds: 200, nanoseconds: 0 });\nexport class Timestamp { constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; } }\nexport const where = (field, operator, value) => ({ field, operator, value });\nexport const query = (source, condition) => ({ ...source, condition });\nexport const setDoc = async () => {};\nexport function onSnapshot(source, options, next) { lastQuery = source; listener = next; return () => { listener = null }; }\nexport async function runTransaction(_db, callback) {\n transactionCount++; const pending = []; let writing = false;\n const transaction = { get: async ref => { if (writing) throw new Error('Read after write'); const row = rows[ref.id]; return { exists: () => !!row, data: () => row }; }, set: (ref, row) => { writing = true; pending.push([ref.id, row]); } };\n await callback(transaction);\n for (const [id, row] of pending) { rows[id] = row; writes.push([id, row]); }\n}\n")
const firebaseUrl = url("export const auth = { currentUser: { uid: 'alice', emailVerified: true } }; export const db = {};\n")
const sdk = await import(sdkUrl)
const firebase = await import(firebaseUrl)
const compile = (name, replacements = {}) => {
 let source = ts.transpileModule(readFileSync(new URL('../src/lib/' + name + '.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
 for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, JSON.stringify(to))
 return url(source)
}
const modelUrl = compile('cloudModel', { "'./importStorage'": compile('importStorage'), "'./manualStorage'": compile('manualStorage') })
const storage = await import(compile('cloudStorage', { "'firebase/firestore'": sdkUrl, "'./firebase'": firebaseUrl, "'./cloudModel'": modelUrl }))
const session = { id: 10, training: 'Training', date: '2026-10-08T12:00:00.000Z', duration: 60, style: 'Gi', classType: 'Training', venue: '', instructor: '', notes: '' };
const record = (revision = 1, extra = {}) => ({ kind: 'manual', data: session, revision, deleted: false, fileName: '', updatedAt: { seconds: 100, nanoseconds: 1 }, ...extra });
const change = (id, revision = 0, extra = {}) => ({ id, kind: 'manual', data: session, expectedRevision: revision, deleted: false, fileName: '', ...extra });
test('transactions reject stale edits without writing any rows', async () => {
 sdk.reset({ stale: record(2) });
 await assert.rejects(storage.commitChanges('alice', [change('new'), change('stale', 1)]), /Conflict:/);
 assert.equal(sdk.writes.length, 0);
 assert.equal(sdk.rows.new, undefined);
});
test('transactions commit only the changed row with the next revision', async () => {
 sdk.reset({ a: record(2), untouched: record() });
 await storage.commitChanges('alice', [change('a', 2)]);
 assert.equal(sdk.writes.length, 1); assert.equal(sdk.rows.a.revision, 3); assert.equal(sdk.rows.untouched.revision, 1);
});
test('guest import skips a record concurrently created on another device', async () => {
 sdk.reset({ a: record(7) });
 await storage.commitChanges('alice', [change('a', 0, { onlyIfMissing: true }), change('b', 0, { onlyIfMissing: true })]);
 assert.equal(sdk.rows.a.revision, 7); assert.equal(sdk.rows.b.revision, 1);
});
test('large imports use bounded transaction chunks', async () => {
 sdk.reset(); await storage.commitChanges('alice', Array.from({ length: 201 }, (_, i) => change('row-' + i)));
 assert.equal(sdk.transactionCount, 3); assert.equal(sdk.writes.length, 201);
});
test('account switches prevent writes to the previous account', async () => {
 sdk.reset(); firebase.auth.currentUser.uid = 'bob';
 try { await assert.rejects(storage.commitChanges('alice', [change('a')]), /Account changed/); assert.equal(sdk.writes.length, 0); }
 finally { firebase.auth.currentUser.uid = 'alice'; }
});
test('incremental subscriptions include the newest timestamp and keep deletion markers', () => {
 let result;
 const stop = storage.subscribeRecords('alice', { a: record(1), b: record(1, { updatedAt: { seconds: 101, nanoseconds: 5 } }) }, (rows, cached) => { result = { rows, cached }; }, error => { throw error; });
 assert.equal(sdk.lastQuery.condition.operator, '>='); assert.equal(sdk.lastQuery.condition.value.seconds, 101);
 sdk.listener({ metadata: { hasPendingWrites: false, fromCache: false }, docChanges: () => [{ type: 'added', doc: { id: 'a', data: () => record(2, { deleted: true }) } }] });
 assert.equal(result.rows.a.deleted, true); assert.equal(result.rows.b.revision, 1); assert.equal(result.cached, false);
 stop(); assert.equal(sdk.listener, null);
});
