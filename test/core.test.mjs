import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVideoUrl, retrieveTranscript, makeOutputs } from '../src/core.mjs';

const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const payload = { lang: 'zh', content: [
  { text: '先记录一个具体问题。', offset: 0, duration: 5000 },
  { text: '用一次小实验验证理解。', offset: 65000, duration: 4000 }
] };

test('only canonical public YouTube page URLs reach the provider', () => {
  assert.equal(normalizeVideoUrl('https://youtu.be/dQw4w9WgXcQ?si=tracking'), url);
  for (const bad of ['https://example.com/a.mp4','http://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://private:secret@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=invalid']) {
    assert.throws(() => normalizeVideoUrl(bad));
  }
});

test('one official SDK request uses native mode and retains timestamps', async () => {
  const calls = [];
  const client = { transcript: async p => { calls.push(p); return payload; } };
  assert.deepEqual(await retrieveTranscript(client, url), payload);
  assert.deepEqual(calls, [{url, mode:'native', text:false}]);
});

test('async responses reuse their original job and support nested SDK results', async () => {
  let initial = 0;
  const ids = [];
  const transcript = Object.assign(async () => { initial++; return {jobId:'offline-job'}; }, {
    getJobStatus: async id => { ids.push(id); return ids.length === 1
      ? {status:'active'} : {status:'completed',result:payload}; }
  });
  assert.deepEqual(await retrieveTranscript({transcript}, url, {sleep:async()=>{}}), payload);
  assert.equal(initial, 1);
  assert.deepEqual(ids, ['offline-job','offline-job']);
});

test('pending jobs stop after five status checks without a second paid request', async () => {
  let initial = 0, polls = 0;
  const transcript = Object.assign(async () => { initial++; return {jobId:'offline-job'}; }, {
    getJobStatus: async () => { polls++; return {status:'queued'}; }
  });
  await assert.rejects(retrieveTranscript({transcript},url,{sleep:async()=>{}}), {code:'job-pending'});
  assert.equal(initial, 1);
  assert.equal(polls, 5);
});

test('provider errors stop immediately instead of retrying or generating audio', async () => {
  let calls = 0;
  const client = {transcript: async () => {calls++;throw Object.assign(new Error('private response'),{error:'limit-exceeded'});}};
  await assert.rejects(retrieveTranscript(client,url), {error:'limit-exceeded'});
  assert.equal(calls, 1);
});

test('outputs label excerpts honestly and remove a key if it appears in returned text', () => {
  const secret = 'TEST_PLACEHOLDER_NOT_A_REAL_KEY';
  const input = {lang:'zh',content:[...payload.content,{text:`Unexpected ${secret}`,offset:90000}]};
  const result = makeOutputs(input,url,secret);
  assert.ok(result.markdown.includes('[01:05]'));
  assert.ok(result.markdown.includes('字幕摘录'));
  assert.ok(!result.markdown.includes(secret));
  assert.ok(!result.markdown.includes('PLACEHOLDER'));
  assert.ok(!result.text.includes(secret));
  assert.ok(result.text.includes('[REDACTED]'));
});

test('an empty transcript never produces a misleading note', () => {
  assert.throws(() => makeOutputs({content:[]},url), {code:'empty-transcript'});
});
