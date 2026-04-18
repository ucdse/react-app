# React + TypeScript + Vite

<p align="center">
  <a href="./README.md">English</a> | 简体中文
</p>

这是一个用于在 Vite 中使用 React 的最小化模板，支持热模块替换（HMR）和一些 ESLint 规则。

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式**: Tailwind CSS 4
- **UI 组件**: Radix UI
- **图表**: Recharts
- **路由**: React Router v7
- **HTTP 客户端**: Axios
- **通知**: Sonner

## 可用脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器（已启用 `--host`） |
| `npm run build` | 构建生产版本（先运行 TypeScript 检查） |
| `npm run preview` | 本地预览生产构建 |
| `npm run lint` | 对所有文件运行 ESLint |

## 本地部署步骤

### 环境要求

- **Node.js**：推荐使用 18.x 或更高版本（使用 `node -v` 检查）
- **npm** 或 **pnpm** / **yarn**（npm 随 Node 安装附带）

### 1. 克隆并进入项目目录

```bash
git clone <repository-url>
cd react-app
```

如果您已经在项目根目录中，请跳过此步骤。

### 2. 复制环境配置文件

```bash
cp .env.example .env
```

然后编辑 `.env` 文件并填写你的 API 密钥：

| 变量 | 描述 |
|------|------|
| `VITE_PUBLIC_API_KEY` | 你的公共 API 密钥 |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API 密钥（如果使用地图功能） |

**注意**: Vite 只会将带有 `VITE_` 前缀的变量暴露给前端代码。不要在这里放置真正的机密密钥，因为它们可以在浏览器包中被看到。

### 3. 安装依赖

```bash
npm install
```

### 4. 启动开发环境

```bash
npm run dev
```

启动后，终端会显示本地访问地址（例如 `http://localhost:5173`），在浏览器中打开即可。已配置 `--host`，因此您可以在同一局域网内通过本机 IP 访问。

### 5. 构建和预览（可选）

- **构建生产版本**：
  ```bash
  npm run build
  ```
  输出文件位于 `dist/` 目录。

- **本地预览构建**：
  ```bash
  npm run preview
  ```
  用于本地验证打包后的应用程序。

目前有两个官方插件可用：

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) 使用 [Babel](https://babeljs.io/)（或在 [rolldown-vite](https://vite.dev/guide/rolldown) 中使用 [oxc](https://oxc.rs)）实现快速刷新
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) 使用 [SWC](https://swc.rs/) 实现快速刷新

## React 编译器

此模板默认未启用 React 编译器，因为它会影响开发和构建性能。要添加 React 编译器，请参阅[此文档](https://react.dev/learn/react-compiler/installation)。

## ESLint 配置

本项目使用 ESLint，配置如下：

```js
// eslint.config.js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
])
```

### 扩展 ESLint 用于生产环境

如果您正在开发生产级应用程序，可以启用类型感知 lint 规则：

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // ...现有配置
      // 将 tseslint.configs.recommended 替换为：
      tseslint.configs.recommendedTypeChecked,
      // 或者使用更严格的规则：
      // tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

您还可以安装 [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) 和 [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) 以获取额外的 React 特定 lint 规则。
