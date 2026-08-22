require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  if (process.env.DISCORD_TOKEN) {
    try {
      require("./bot/index.js");
    } catch (error) {
      console.error("❌ Failed to start Discord bot:", error);
    }
  } else {
    console.warn("⚠️ DISCORD_TOKEN is missing; starting web only.");
  }

  createServer((req, res) => {
    const pathname = req.url ? parse(req.url, true).pathname : "";
    if (pathname === "/ping" && (req.method === "HEAD" || req.method === "GET")) {
      console.log(`[ping] ${req.method} ${new Date().toISOString()}`);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
      return;
    }

    handle(req, res, parse(req.url, true));
  }).listen(port, () => {
    console.log(`🌐 Web + bot listening on port ${port}`);
  });
});
