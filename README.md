# Skill Management Frontend

Skill 管理平台的独立前端服务，基于 Vue 3、TypeScript 和 Vite。

## 本地开发

```bash
npm install
npm run dev
```

默认访问地址为 `http://127.0.0.1:5173`。

本地配置已写入 `.env`，前端启动不再需要额外传递环境变量。默认使用
`http://127.0.0.1:5173`；需要飞书 H5 或外网测试时，再通过后端环境变量开启 HTTPS Mock。
`.env` 中只允许放浏览器端配置，不要放 App Secret。

所有后端 HTTP 和 SSE 请求统一由 `VITE_API_BASE_URL` 配置。例如本地后端运行在
8090 时：

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8090/api/v1
```

开发服务器会自动把 `/api/v1` 转发到该地址，无需在代码或 Vite 配置中重复填写端口。

## 质量检查

```bash
npm run typecheck
npm run lint
npm run build
```

客户端环境变量可参考 `.env.example`，所有 `VITE_` 变量都会被打包到浏览器端，不应存放密钥。

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
