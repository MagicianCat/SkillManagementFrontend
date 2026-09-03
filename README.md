# Skill Management Frontend

Skill 管理平台的独立前端服务，基于 Vue 3、TypeScript 和 Vite。

## 本地开发

```bash
npm install
npm run dev
```

默认访问地址为 `http://127.0.0.1:5173`。

## 质量检查

```bash
npm run typecheck
npm run lint
npm run build
```

客户端环境变量可参考 `.env.example`，所有 `VITE_` 变量都会被打包到浏览器端，不应存放密钥。

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
