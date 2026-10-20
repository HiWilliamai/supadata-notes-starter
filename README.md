# Supadata Notes Starter

一个简单的 Node.js 模板：**YouTube 链接 → Supadata 已有字幕 → Markdown 学习笔记草稿**。

使用官方 [`@supadata/js`](https://github.com/supadata-ai/js)。只分享独立的小工具，不需要其他应用的代码或数据库。

## 先试离线演示

需要 Node.js 22.9 或更新版本。

```sh
npm ci
npm run demo
```

演示使用仓库内原创的三段示例字幕，**不需要 API Key，不发网络请求，不消耗积分**。结果在 `output/demo/`：

- `transcript.txt`：字幕纯文本。
- `study-note.md`：来源、带时间点的摘录和待核实问题。

这是一份供人工继续整理的笔记草稿，不会把前三段字幕冒充 AI 总结。

## 使用自己的 Key

复制空白配置示例，在本机填写自己的 Key：

```sh
cp .env.example .env
```

PowerShell 可以使用 `Copy-Item .env.example .env`。然后编辑 `.env`：

```dotenv
SUPADATA_API_KEY=YOUR_API_KEY
```

使用自己有权处理的公开视频：

```sh
npm start -- "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

支持 `youtube.com/watch?v=...` 与 `youtu.be/...`。结果写入 `output/视频ID/`；再次运行相同视频会重新请求并覆盖该目录的两个输出文件。

## 调用方式与费用

核心只有一次官方 SDK 调用：

```js
const result = await client.transcript({
  url: normalizedUrl,
  mode: "native",
  text: false
});
```

`text: false` 保留时间点；`native` 只取已有字幕，不自动进入按时长收费的 AI 转写。没有字幕、额度不足或请求失败会停止，不重新创建请求。若返回任务 ID，只对同一个 ID 最多查询 5 次，之后停止；本地停止不会取消服务端已接受的任务。

按当前官方说明，已有字幕通常每次 1 credit，返回 206 的字幕不可用查询也收费；任务状态查询不收费。价格和响应格式请以[官方文档](https://docs.supadata.ai/get-transcript)为准。

## Key 怎样保护

- 仓库只包含空白 `.env.example`；`.env`、其他 `.env.*` 和 `output/` 已忽略。
- 程序从运行者自己的 `SUPADATA_API_KEY` 读取 Key，不打印 Key 或原始错误响应。
- Key 只交给官方 SDK，不写入字幕或 Markdown 输出。
- 测试使用明显的假 Key 和离线响应，不访问真实账号。
- 发布、提交代码前，仍应检查 `git diff --cached`，不要使用 `git add -f .env`。

```sh
npm test
git check-ignore .env
git diff --cached
```

## 推广披露

Supadata 入口：[supadata.ai/r/TPT219DS](https://supadata.ai/r/TPT219DS)。这是个人推广链接；作者可能通过 Supadata 的内容奖励计划获得 API 积分。

MIT License。示例字幕是为本模板新写的演示内容，不是第三方视频全文。
