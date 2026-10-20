export class StarterError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function normalizeVideoUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new StarterError('invalid-url'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new StarterError('invalid-url');
  }
  const id = url.hostname === 'youtu.be'
    ? url.pathname.slice(1)
    : ['youtube.com','www.youtube.com'].includes(url.hostname) && url.pathname === '/watch'
      ? url.searchParams.get('v') : null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new StarterError('invalid-url');
  return `https://www.youtube.com/watch?v=${id}`;
}

export async function retrieveTranscript(client, url, options = {}) {
  const normalized = normalizeVideoUrl(url);
  const response = await client.transcript({url:normalized,mode:'native',text:false});
  if (!response?.jobId) return response;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve,ms)));
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(1000);
    const job = await client.transcript.getJobStatus(response.jobId);
    if (job?.status === 'completed') return job.result ?? job;
    if (['failed','error','cancelled'].includes(job?.status)) throw new StarterError('job-failed');
  }
  throw new StarterError('job-pending');
}

function timestamp(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '时间点未提供';
  const sec = Math.floor(ms / 1000);
  const minutes = Math.floor(sec / 60);
  return `${String(minutes).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
}

function safeMarkdown(text) {
  return text.replace(/[\\`*_<>\[\]]/g, '\\$&').replace(/[\r\n]+/g,' ');
}

export function makeOutputs(transcript, url, secret = '') {
  const content = transcript?.content;
  const segments = (typeof content === 'string'
    ? [{text:content}]
    : Array.isArray(content) ? content : [])
    .filter(s => typeof s?.text === 'string' && s.text.trim());
  if (!segments.length) throw new StarterError('empty-transcript');
  const redact = value => secret ? value.split(secret).join('[REDACTED]') : value;
  const text = redact(segments.map(s=>s.text.trim()).join('\n'));
  const excerpts = segments.slice(0,3).map(s => {
    const raw = redact(s.text.trim());
    return `- [${timestamp(s.offset)}] ${safeMarkdown(raw.slice(0,180))}${raw.length>180?'…':''}`;
  });
  const markdown = redact([
    '# 视频学习笔记草稿', '', `来源：${url}`, `字幕语言：${safeMarkdown(redact(String(transcript.lang ?? '未提供')))}`,
    '', '## 字幕摘录', '',
    '以下仅为前三段字幕摘录，不代表视频重点，也不是 AI 摘要。', '', ...excerpts,
    '', '## 我的理解', '', '回看原视频后，用一句话写下主线。',
    '', '## 待核实', '', '- 作者的判断有什么理由或例子？',
    '- 人名、数字和关键结论是否准确？', '- 是否遗漏了前提、转折或相反观点？', ''
  ].join('\n'));
  return {text,markdown};
}

export function publicErrorMessage(error) {
  const code = error?.code ?? error?.error;
  return ({
    'invalid-url':'请输入有效的 HTTPS YouTube watch 或 youtu.be 视频链接。',
    'missing-key':'未设置 SUPADATA_API_KEY。请在本机 .env 中填写自己的 Key。',
    'empty-transcript':'没有取得可用字幕；未自动重试或切换到 AI 转写。',
    'job-pending':'任务仍未完成；已停止查询，没有重新创建付费请求。',
    'job-failed':'字幕任务失败；未自动重试。',
    'transcript-unavailable':'没有可用的已有字幕；未自动启动 AI 转写。',
    'limit-exceeded':'账号额度不足或请求受限；已停止，没有自动重试。',
    'unauthorized':'Key 未通过验证，请检查本机配置。',
    'upgrade-required':'当前计划不支持此请求；已停止。'
  })[code] ?? '操作失败，请检查网络、权限或输出目录。为保护凭证，未输出原始错误响应。';
}
