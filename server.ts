/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { registerApiRoutes } from "./src/server/apiRoutes";

dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits for uploading food images in base64 format
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Register all API routes (Vite-free)
registerApiRoutes(app);

// -------------------------------------------------------------
// VITE DEV SERVER AND PRODUCTION SERVING MIDDLEWARE
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import so Vite is never loaded in Vercel serverless
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 AI健康陪跑教練伺服器啟動，連接埠: ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
