# ESA Log Analytics Platform

This is an AI-assisted log analytics platform for Alibaba Cloud ESA (Edge Security Acceleration) Functions & Pages.

The project is designed to run as a React static Pages app with an ESA edge function API. The frontend is built into `dist`, while API routes such as `/api/metrics/overview`, `/api/logs/search`, and `/api/ingestion/run` are handled by `functions/index.ts`.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn-style UI components
- Recharts
- Alibaba Cloud ESA Functions & Pages
- ESA EdgeKV

## ESA Build Settings

Use these settings in Alibaba Cloud ESA Functions & Pages:

```text
Production branch: main
Install command: corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile
Build command: pnpm run build
Root directory: /
Static assets directory: dist
Function file path: functions/index.ts
Node.js version: 22.x
```

No environment variables are required by default.

The project also includes `esa.jsonc`:

```jsonc
{
  "entry": "./functions/index.ts",
  "assets": {
    "directory": "./dist",
    "notFoundStrategy": "singlePageApplication"
  }
}
```

## Build Locally

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install
pnpm run build
```

Run tests:

```sh
pnpm test
```

## Notes

- `/api/*` must be routed to ESA Functions. If API requests return HTML, check the ESA function file path and route/domain binding.
- Log ingestion is implemented as incremental batches to stay within ESA edge runtime KV and fetch limits.
- This repository was generated and iteratively refined with AI assistance.
