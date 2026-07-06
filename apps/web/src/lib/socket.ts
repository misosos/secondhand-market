import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

// Single shared socket per tab: multiple useChat() consumers reuse the
// same connection instead of each opening their own.
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(WS_URL, {
    autoConnect: false,
    transports: ["websocket"],
    // Function form re-reads the token from storage on every (re)connect
    // attempt, so a rotated/refreshed access token is picked up
    // automatically without recreating the socket instance.
    auth: (cb) => cb({ token: getAccessToken() }),
  });

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

// Nest's default WS error handling does not invoke the ack callback on a
// thrown exception — it emits a separate, unrelated-to-any-specific-call
// "exception" event instead (confirmed against the actual gateway; see
// apps/api's WsExceptionsFilter). So a failed call's ack simply never
// fires: this wrapper times out rather than hanging forever, and callers
// pair it with a socket-level "exception" listener to surface the message.
export function emitWithAck<T>(socket: Socket, event: string, payload: unknown, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Request timed out"));
      }
    }, timeoutMs);

    socket.emit(event, payload, (response: T) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(response);
      }
    });
  });
}
