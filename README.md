# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Docker

This repository can be built as a Docker image for deployment or Docker Hub publishing.

Build the image:

```bash
docker build -t clio-app .
```

Run the container locally:

```bash
docker run --rm -p 8080:80 clio-app
```

Open http://localhost:8080 in your browser.

If you want to publish to Docker Hub, tag and push the image:

```bash
docker tag clio-app your-dockerhub-username/clio:latest
docker push your-dockerhub-username/clio:latest
```

## Authentication

Every `/api` route requires a signed-in browser session or an access token (see
`server/auth.js` and `docs/changelog/*_auth_gate_changelog.md`). Only the static app, `GET /api/health`,
the sign-in routes and the secret-keyed calendar feed are public.

- **Browser:** "Continue with Google" (server-side OAuth code flow with PKCE, a full-page redirect so it
  works on iPad). Only emails in `CHLIO_ALLOWED_EMAILS` get in. The session is an HttpOnly cookie.
- **Machines (Claude Desktop, Open WebUI, scripts):** create a token in **Account → Access tokens**, or on the host:
  `docker exec clio-app node server/cli.js token create <name> [--scope read|write] [--days N]`.
  Use it as `Authorization: Bearer chlio_pat_...`. Tokens are shown once, stored hashed, and can be revoked.
- **Required `.env`:** `CHLIO_ALLOWED_EMAILS`, `CHLIO_PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  Register `https://<your host>/api/auth/login/google/callback` as an authorized redirect URI on the Google client.
- **Tests:** `cd server && npm install && npm test` (needs `better-sqlite3`; run it in the node:20 image).
- **Locked out?** Anyone who can `docker exec` on the host can mint a token with the CLI above.
