import express from "express";
import cors from "cors";
import imageRoutes from "./routes/imageRoutes";
import receiptRoutes from "./routes/receiptRoutes";
import { errorHandler } from "./shared/errors/error.middleware";
import { appConfig } from "./config/env";

const app = express();
const configuredCorsOrigins = appConfig.corsOrigins;
const testEndpointsEnabled = appConfig.testEndpointsEnabled;

app.use(
  cors({
    // Preserve the existing allow-all behavior unless an allowlist is set.
    origin: configuredCorsOrigins.length > 0 ? configuredCorsOrigins : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true, // Cho phép cookies/sessions cross-origin
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Image processing routes
app.use("/api/image", imageRoutes);
app.use("/api/receipt", receiptRoutes);
app.get("/", (req, res) => {
  res.send("Welcome to the Image Analysis API\n");
});

import { testCallOpenAI } from "@backend/services/analyze/imageProcessor";
if (testEndpointsEnabled) {
  app.post("/test-openai", async (req, res) => {
    await testCallOpenAI();
    res.json({ status: "ok", message: "Test completed successfully" });
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;
