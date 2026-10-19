import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fetchApk, validateGrant, apkRequest, DownloadError, fileSize, type DownloadGrant} from './apk-download.ts';
const bytes = new TextEncoder().encode('PK-a-small-test-apk');
const sha = createHash('sha256').update(bytes).digest('hex');
const grant: DownloadGrant = {file: 'kaylo-customer.apk', bytes: bytes.length, sha256: sha, parts: [{bytes: bytes.length, sha256: sha, url: 'https://jeiwfvnkxubykrzjzktm.supabase.co/storage/v1/object/sign/apks/customer/test?token=test'}]};

test('download links must target the private APK bucket on our backend', () => {
  assert.equal(validateGrant(grant, 'customer'), true);
  assert.equal(validateGrant(grant, 'partner'), false);
  for (const url of ['https://example.com/file.apk', 'javascript:alert(1)', 'http://jeiwfvnkxubykrzjzktm.supabase.co/storage/v1/object/sign/apks/x', 'https://jeiwfvnkxubykrzjzktm.supabase.co/storage/v1/object/sign/documents/x']) {
    assert.equal(validateGrant({...grant, parts: [{...grant.parts[0], url}]}, 'customer'), false);
  }
  assert.equal(validateGrant({...grant, bytes: 1}, 'customer'), false);
  assert.equal(validateGrant({...grant, parts: []}, 'customer'), false);
  assert.equal(fileSize(1048576), '1.0 MB');
});
test('verified parts produce the exact original APK and complete progress', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(bytes));
  const progress: number[] = [];
  const blob = await fetchApk(grant, 'customer', n => progress.push(n), new AbortController().signal);
  assert.equal(blob.type, 'application/vnd.android.package-archive');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.equal(progress.at(-1), 100);
});
test('truncated and corrupted responses never produce an installable APK', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(bytes.slice(1)));
  await assert.rejects(fetchApk(grant, 'customer', () => {}, new AbortController().signal), /verified/);
  fetch.mock.mockImplementation(async () => new Response(new Uint8Array(bytes.length)));
  await assert.rejects(fetchApk(grant, 'customer', () => {}, new AbortController().signal), /verified/);
  fetch.mock.mockImplementation(async () => new Response(new Uint8Array(bytes.length + 1)));
  await assert.rejects(fetchApk(grant, 'customer', () => {}, new AbortController().signal), /size/);
});
test('server authentication failure stays locked and reports a useful error', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status: 401}));
  await assert.rejects(apkRequest('unlock', {password: 'test-wrong-value'}), e => e instanceof DownloadError && e.status === 401);
});
