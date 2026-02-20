# Quick Wins -- Things That Take < 1 Hour Each

These are small changes that will immediately make Tek feel more polished, independent of the bigger phase work.

## CLI Quick Wins

### 1. Add Unicode Box Characters to StatusBar
Replace `borderStyle="single"` with `borderStyle="round"` on the StatusBar. Instant visual upgrade for free.
```
File: packages/cli/src/components/StatusBar.tsx line 29
Change: borderStyle="single" -> borderStyle="round"
```

### 2. Add Empty State to Chat
When the user opens `tek chat` with no messages, show a centered welcome message with the agent name, available slash commands, and keyboard shortcuts. Right now it's just a blank screen with a `>` prompt.

### 3. Add Timestamps to MessageBubble
Add a dimmed timestamp (HH:MM) to the right side of each message. The data is already in the `ChatMessage` type.
```
File: packages/cli/src/components/MessageBubble.tsx
```

### 4. Truncate Long Tool Output
Tool call outputs can flood the screen. Add a line limit (e.g., 20 lines) with a `... (N more lines)` indicator.
```
File: packages/cli/src/components/MessageBubble.tsx, tool_call case
```

### 5. Show Model in StreamingResponse with Shorter Name
The model name display already shortens it, but during streaming it shows the full model string. Use the same shortening logic from StatusBar.

## Desktop Quick Wins

### 6. Add Error Boundaries
Wrap each page in a React error boundary. One bad render shouldn't crash the whole app.
```tsx
// Simple ErrorBoundary component, wrap in Layout.tsx
```

### 7. Add Page Transition Fade
CSS-only transition when switching pages. Even a 150ms opacity fade makes it feel intentional.
```css
/* In index.css */
.page-enter { opacity: 0; }
.page-enter-active { opacity: 1; transition: opacity 150ms ease-in; }
```

### 8. Add Favicon / Window Title
Set the Tauri window title to show the current page ("Tek - Chat", "Tek - Settings").
```
File: apps/desktop/src-tauri/tauri.conf.json and App.tsx
```

### 9. Empty Chat State Illustration
Replace the plain text "Send a message to start chatting" with a simple SVG illustration or ASCII art + the text. Makes the empty state feel designed rather than placeholder.

### 10. Add Copy Button to Chat Messages
A small copy icon on hover for assistant messages. Users will want to copy code/responses constantly.
```
File: apps/desktop/src/components/ChatMessage.tsx
```

## Architecture Quick Wins

### 11. Add WebSocket Auto-Reconnect
Both CLI and desktop WebSocket clients disconnect permanently on connection loss. Add exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s).
```
Files: packages/cli/src/hooks/useWebSocket.ts, apps/desktop/src/hooks/useWebSocket.ts
```

### 12. Add Gateway Health Check Endpoint
Add a simple `GET /health` endpoint to the gateway that returns `{ status: "ok", uptime: N, sessions: N }`. Useful for the dashboard and for monitoring.
```
File: packages/gateway/src/key-server/routes.ts (already has /health, but enhance it)
```
