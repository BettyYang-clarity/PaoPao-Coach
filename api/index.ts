/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { registerApiRoutes } from "../src/server/apiRoutes";

const app = express();

// Vercel already parses the body, but we need express.json() for the Express
// route handlers that access req.body. Vercel's body parsing is compatible
// with Express when we set the limit high enough.
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Register all API routes
registerApiRoutes(app);

export default app;
