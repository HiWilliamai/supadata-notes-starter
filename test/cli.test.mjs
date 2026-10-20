import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.mjs',import.meta.url));
const fakeKey = 'TEST_PLACEHOLDER_NOT_A_REAL_KEY';

test('the actual SDK and CLI save notes without leaking a key or making a live request', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(),'supadata-starter-'));
  try {
    const preload = `import assert from 'node:assert/strict';
globalThis.fetch=async (input,options)=>{
const u=new URL(input);assert.equal(u.origin,'https://api.supadata.ai');
assert.equal(u.searchParams.get('mode'),'native');
assert.equal(options.headers['x-api-key'],${JSON.stringify(fakeKey)});
assert.match(options.headers['User-Agent'],/^supadata-js\\//);
return new Response(JSON.stringify({lang:'en',content:[{text:'A test sentence. ${fakeKey}',offset:0}]}),{status:200,headers:{'content-type':'application/json'}});
};`;
    const result = spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),cli,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],{cwd,env:{...process.env,SUPADATA_API_KEY:fakeKey},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const note = await readFile(path.join(cwd,'output/dQw4w9WgXcQ/study-note.md'),'utf8');
    const transcript = await readFile(path.join(cwd,'output/dQw4w9WgXcQ/transcript.txt'),'utf8');
    for (const content of [result.stdout,result.stderr,note,transcript]) {
      assert.ok(!content.includes('PLACEHOLDER'));
    }
    assert.ok(note.includes('[00:00]'));
  } finally {
    await rm(cwd,{recursive:true,force:true});
  }
});

test('demo works without a key and never calls the network', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(),'supadata-demo-'));
  try {
    const forbid = 'globalThis.fetch=()=>{throw new Error("Network must not be called")};';
    const result = spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(forbid),cli,'--demo'],
      {cwd,env:{...process.env,SUPADATA_API_KEY:''},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const note = await readFile(path.join(cwd,'output/demo/study-note.md'),'utf8');
    assert.ok(note.includes('原创示例字幕'));
  } finally {
    await rm(cwd,{recursive:true,force:true});
  }
});
