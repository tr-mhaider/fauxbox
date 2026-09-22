# @fauxbox/web

The Fauxbox dashboard, a Next.js (App Router) app that talks to the Go API over
HTTPS and websockets.

Phase 0 is a placeholder. Auth, the API client, the websocket client, and the
UI are built in Phases 8 and 9 on the shared design system in `packages/ui`.

## Local development

```
npm install
npm run dev      # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` to the API base URL (see the repo root `.env.example`).
Or run the whole stack with `docker compose up` from the repo root.
