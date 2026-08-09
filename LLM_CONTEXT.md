# AgentHub Architecture & Context

This document is designed to give an LLM full context on how the AgentHub project is structured, its architecture, and how its various moving parts communicate.

## 1. High-Level Architecture
AgentHub is a monorepo consisting of three main pieces:
- **`web/`**: A Next.js frontend (React, TypeScript) running on port `3000`.
- **`api/`**: A Fastify backend (TypeScript) handling auth, database, model routing, and agent execution.
- **`electron/`**: A native desktop wrapper that packages the Web UI and API into a standalone local application.

### The Cloud vs Desktop Split (Deployment Modes)
The architecture uses a split-brain model governed by the `DEPLOYMENT_MODE` environment variable. 
1. **Cloud Mode (`DEPLOYMENT_MODE='cloud'`)**: 
   - Deployed centrally.
   - Handles global logic: GitHub Authentication (`/auth`), the public Tool Marketplace (`/marketplace`), and Creator Dashboards (`/creator`). 
   - Does *not* have access to local file systems.
2. **Desktop Mode (`DEPLOYMENT_MODE='desktop'`)**: 
   - Runs locally on the user's machine (spawned by Electron as a background process).
   - Handles local logic: Executing models (`/models/chat`) and agent tools that require host filesystem/Docker access.

**Network Routing in Dev (`next.config.ts`)**: The Next.js frontend proxies all `/api/*` requests to `http://127.0.0.1:8081` (the Cloud API). Meanwhile, Electron internally spawns its own Desktop API on port `8080`. The web app connects directly to `8080` for local agent actions while routing through the Next proxy to `8081` for marketplace actions.

## 2. Dev Commands (`package.json`)
We use `concurrently` in the root to boot all required processes.
- `pnpm start`: Boots the Next.js frontend, the Cloud API (`cross-env DEPLOYMENT_MODE=cloud`), and the Electron wrapper.
- **Desktop Hot Reload**: When running in dev mode (`!app.isPackaged`), Electron explicitly forks `tsx watch ../api/src/index.ts` to run the Desktop API. This ensures the backend hot-reloads identically to the Cloud API without needing a manual `pnpm build` of the `dist/` directory.

## 3. Database & Schema
The project uses PostgreSQL with **Drizzle ORM** (`api/src/db/schema.ts`).
- **Users**: Identified by `isAnonymous` (for browser-only sessions) or `oauthProvider` / `oauthId` (GitHub).
- **ApiKeys**: Securely stores API keys for logged-in users. `encryptedKey` uses AES-256-GCM encryption.
- **Tools**: The marketplace registry. Contains `packageUrl`, `manifestJson`, etc.
- **Installs**: Tracks which users installed which tools.
- **ToolEvents**: Telemetry and metrics for tool invocations and errors.

## 4. API Routes (`api/src/routes/`)
- `auth.ts`: Handles GitHub OAuth flow and session verification (`/auth/me`). Uses the `device_id` cookie for both anonymous and authenticated sessions. If OAuth keys are missing from `.env`, it will explicitly fail with a 500 error instead of falling back to any mock users.
- `marketplace.ts`: Public API to list and query available tools.
- `creator.ts`: Private API for authenticated tool developers to view metrics.
- `keys.ts`: CRUD operations for securely storing API keys in the DB vault.
- `models.ts`: The core endpoint (`POST /models/chat`). Receives LLM prompts, resolves the API key (from DB vault or request header), spins up the Agent Loop, and streams Server-Sent Events (SSE) back to the client.
- `agent.ts`: Auxiliary endpoints, such as `/agent/confirm`, which resolves execution pauses when tools (like `run_command`) require explicit user approval.

## 5. Security & Authentication Model
- **BYOK (Bring Your Own Key) Priority**: The primary storage model is browser `localStorage`. When making a chat request, the UI injects it into the `Authorization: Bearer <key>` header. **This header takes strict precedence over the database vault**, meaning users can always manage their keys locally even if they are logged in.
- **Encrypted Vault**: Users who sign in with GitHub can optionally store keys in the Postgres DB (AES-256-GCM). The Fastify `session.ts` plugin verifies the `device_id` cookie, and `gateway.ts` only falls back to the vault if no header key was provided.
- **Workspace Isolation**: In `models.ts`, local file execution is strictly guarded. It requires `DEPLOYMENT_MODE === 'desktop'` unconditionally. The workspace path is securely resolved via `ProjectWorkspace` which strictly prevents `../` symlink escapes and bounds execution to the selected directory.

## 6. Agent Executors (`api/src/lib/agent/executors/`)
When a user asks the LLM to do something, the Model Gateway routes tool calls to Executors.
- **`BuiltinExecutor`**: Implements 6 core coding tools (`read_file`, `write_file`, `apply_diff`, `list_dir`, `run_command`, `search_codebase`). Runs natively on the host but strictly bounded by `ProjectWorkspace`.
- **`StdioMcpExecutor`**: Executes third-party marketplace tools. It pulls a Docker image and spins up a container to isolate untrusted code. It mounts the user's workspace as `read-only` (`:ro`) and drops capabilities/network access. It communicates with the tool inside the container via standard input/output using the MCP JSON-RPC protocol.
