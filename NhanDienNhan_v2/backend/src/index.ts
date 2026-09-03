import app from "./app";
import { appConfig } from "./config/env";
import { ocrArchive } from "./shared/archive/ocrArchive";

async function startServer(): Promise<void> {
  try {
    await ocrArchive.recoverStalePending();
  } catch (error) {
    console.error("ARCHIVE_WRITE_FAILED", {
      operation: "startup-recovery",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  app.listen(appConfig.port, () =>
    console.log(`Server running on port ${appConfig.port}`),
  );
}

void startServer();
