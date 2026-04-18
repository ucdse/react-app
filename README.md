
# React + TypeScript + Vite

<p align="center">
  English | <a href="./README.zh-CN.md">简体中文</a>
</p>

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **Charts**: Recharts
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **Notifications**: Sonner

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with `--host` enabled |
| `npm run build` | Build for production (runs TypeScript check first) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on all files |

## Local Deployment Steps

### Environment Requirements

- **Node.js**: Recommended 18.x or higher (check with `node -v`)
- **npm** or **pnpm** / **yarn** (npm comes with Node installation)

### 1. Clone and Enter Project Directory

```bash
git clone <repository-url>
cd react-app
```

Skip this step if you are already in the project root directory.

### 2. Copy Environment Configuration

```bash
cp .env.example .env
```

Then edit `.env` and fill in your API keys:

| Variable | Description |
|----------|-------------|
| `VITE_PUBLIC_API_KEY` | Your public API key |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key (if using maps features) |

**Note**: Vite only exposes variables prefixed with `VITE_` to frontend code. Do not put truly secret keys here as they can be seen in the browser bundle.

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Environment

```bash
npm run dev
```

After starting, the terminal will display the local access address (e.g., `http://localhost:5173`), open it in your browser. `--host` is configured, so you can access via your machine's IP within the same local network.

### 5. Build and Preview (Optional)

- **Build production version**:
  ```bash
  npm run build
  ```
  Output is in the `dist/` directory.

- **Preview build locally**:
  ```bash
  npm run preview
  ```
  Used to verify the packaged application locally.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## ESLint Configuration

The project uses ESLint with the following configuration:

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

### Expanding ESLint for Production

If you are developing a production application, you can enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // ...existing configs
      // Replace tseslint.configs.recommended with:
      tseslint.configs.recommendedTypeChecked,
      // Or use stricter rules:
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

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for additional React-specific lint rules.
