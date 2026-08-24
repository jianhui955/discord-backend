export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    typeof globalThis.WebSocket === "undefined"
  ) {
    const { WebSocket } = await import("ws");
    globalThis.WebSocket = WebSocket as typeof globalThis.WebSocket;
  }
}
