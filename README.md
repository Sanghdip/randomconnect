# RandomConnect — updated implementation

A full-stack starter for random text/video chat with persistent conversation history, WebSocket signaling, WebRTC camera/mic, screen sharing, reporting and blocking.

## What is wired up

- Responsive dark UI
- Anonymous-at-the-interface user IDs stored in localStorage
- Random matchmaking endpoint
- Persistent in-process conversation/message store for local development
- REST API for profile, history, messages, block and report
- WebSocket signaling for matchmaking and WebRTC
- WebRTC camera + microphone
- Screen sharing with `getDisplayMedia()`
- STUN/TURN configuration through environment variables
- SQL migrations for D1/SQLite-style durable storage
- Vite frontend + Hono Node server

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Use two browser windows (or one normal + one incognito window) to test matchmaking.

### Video testing

Browser camera/microphone access works on `localhost` or HTTPS. For two different devices on a LAN, use HTTPS or a tunnel.

### TURN

Set these variables when direct peer-to-peer connectivity is insufficient:

```env
STUN_URL=stun:stun.l.google.com:19302
TURN_URL=turn:your-turn-host:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

Use a trusted TURN provider or your own properly configured coturn server.

## Production checklist

1. Replace the in-memory store with the target runtime's durable D1 adapter.
2. Use server-side authentication/session validation rather than trusting `x-user-id`.
3. Put the site behind HTTPS.
4. Configure a TURN service.
5. Add rate limiting and abuse controls at the edge/server.
6. Persist reports/blocks and add an admin moderation workflow.
7. Add retention/deletion policies for message history.
8. Validate WebSocket origin and session authorization.
9. Configure production environment secrets outside source control.
10. Run `npm run build` and serve the built frontend/backend through the selected host.

## OpenAI Sites

The repository keeps `.openai/hosting.json` as the hosting configuration starter. The target Sites environment must provide the actual durable database binding and WebSocket runtime; those deployment-specific bindings cannot be fabricated locally.

## Project map

- `public/` — browser UI, CSS and Vite entry
- `src/server/routes/api.ts` — HTTP API
- `src/server/store.ts` — local development persistence adapter
- `src/server/ws.ts` — connected-client hub
- `src/server/index.ts` — HTTP + WebSocket server
- `src/client/webrtc.ts` — WebRTC media/signaling client
- `src/server/db/migrations/` — durable SQL schema
