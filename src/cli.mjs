import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StarterError, normalizeVideoUrl, retrieveTranscript, makeOutputs, publicErrorMessage } from './core.mjs';

async function main() {
  const arg = process.argv[2];
  if (!arg || ['--help','-h'].includes(arg)) {
    console.log('用法：npm run demo 或 npm start -- "https://www.youtube.com/watch?v=VIDEO_ID"');
    return;
  }
  let transcript, url, id;
  const secret = String(process.env.SUPADATA_API_KEY ?? '').trim();
  if (arg === '--demo') {
    transcript = JSON.parse(await readFile(new URL('../examples/demo-transcript.json',import.meta.url),'utf8'));
    url = '离线演示（原创示例字幕，无对应第三方视频）';
    id = 'demo';
  } else {
    url = normalizeVideoUrl(arg);
    if (!secret) throw new StarterError('missing-key');
    const { Supadata } = await import('@supadata/js');
    const client = new Supadata({apiKey:secret});
    transcript = await retrieveTranscript(client,url);
    id = new URL(url).searchParams.get('v');
  }
  const output = makeOutputs(transcript,url,secret);
  const directory = path.join(process.cwd(),'output',id);
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'transcript.txt'),output.text,'utf8');
  await writeFile(path.join(directory,'study-note.md'),output.markdown,'utf8');
  console.log(arg === '--demo' ? '离线演示完成：未发网络请求。' : '已有字幕已保存。');
  console.log(`文件：output/${id}/transcript.txt 与 output/${id}/study-note.md`);
}

main().catch(error => {
  console.error(publicErrorMessage(error));
  process.exitCode = 1;
});
