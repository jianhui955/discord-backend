const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
require("./bot/polyfill-websocket");

const { createServer } = require("http");
const { parse } = require("url");

const port = Number(process.env.PORT) || 3000;
let handle = null;

const server = createServer((req, res) => {
  const pathname = req.url ? parse(req.url, true).pathname : "";

  if (pathname === "/ping" && (req.method === "HEAD" || req.method === "GET")) {
    const ua = String(req.headers["user-agent"] || "");
    if (ua.toLowerCase().includes("uptimerobot")) {
      console.log(`[ping] ${req.method} ${new Date().toISOString()}`);
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
    return;
  }

  if (handle) {
    handle(req, res, parse(req.url, true));
    return;
  }

  res.statusCode = 503;
  res.setHeader("Retry-After", "3");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    "<!doctype html><meta http-equiv=\"refresh\" content=\"3\"><p>后台启动中，请稍候自动刷新…</p>",
  );
});

server.listen(port, "0.0.0.0", async () => {
  console.log(`🌐 Listening on port ${port}`);

  if (process.env.DISCORD_TOKEN) {
    try {
      require("./bot/index.js");
    } catch (error) {
      console.error("❌ Failed to start Discord bot:", error);
    }
  } else {
    console.warn("⚠️ DISCORD_TOKEN is missing; starting web only.");
  }

  const next = require("next");
  const app = next({ dev: false });
  await app.prepare();
  handle = app.getRequestHandler();
  console.log("🌐 Next.js ready");
});
