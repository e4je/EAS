# EAS Log Analytics Platform

This is an AI-assisted log analytics platform for Alibaba Cloud ESA access logs.

The project now runs as a self-hosted Node.js application. The React frontend is built into `dist`, while the local Node server handles `/api/*` and serves the static frontend files.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn-style UI components
- Recharts
- Node.js HTTP server
- File-backed local storage

## Local Build

Use Node.js 22.x.

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install
pnpm run build
pnpm start
```

The app listens on:

```text
http://localhost:3000
```

Set a custom port with:

```sh
PORT=8080 pnpm start
```

On Windows PowerShell:

```powershell
$env:PORT=8080
pnpm start
```

## Development

Run the API server:

```sh
pnpm run dev:api
```

Run the Vite frontend in another terminal:

```sh
pnpm run dev
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:3000`.

## Data Storage

Runtime data is stored in `.data/` by default:

```text
.data/config/datasources.json
.data/logs/logs.json
.data/logs/ingestion_files.json
.data/alerts/rules.json
.data/alerts/events.json
```

This directory is ignored by git because datasource configuration can contain access keys.

To store data elsewhere:

```sh
DATA_DIR=/var/lib/eas pnpm start
```

On Windows PowerShell:

```powershell
$env:DATA_DIR="D:\eas-data"
pnpm start
```

## Useful Commands

```sh
pnpm run build
pnpm start
pnpm test
```

## Notes

- `/api/*` is no longer handled by Alibaba Cloud ESA Functions.
- The server has no built-in authentication yet. Do not expose it publicly without putting it behind a trusted reverse proxy, VPN, or auth layer.
- Log ingestion is no longer constrained by ESA edge runtime KV and fetch call limits, but very large datasets may still require pagination, database storage, or background jobs.
