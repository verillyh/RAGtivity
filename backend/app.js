import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import cookieParser from "cookie-parser";
import ragRoutes from "./ragRoutes.js";

import { getFrontendUrl } from "./config/env.js";
import healthRoutes from "./routes/health.js";
import documentsRoutes from "./routes/documents.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";

export async function createApp() {
  const app = express();

  app.use(
    cors({
      origin: getFrontendUrl(),
      credentials: true,
    })
  );
  app.use(fileUpload());
  app.use(express.json());
  app.use(cookieParser());

  app.use("/rag", ragRoutes);

  app.use("/", healthRoutes);
  app.use("/", documentsRoutes);
  app.use("/", authRoutes);
  app.use("/", usersRoutes);

  return app;
}