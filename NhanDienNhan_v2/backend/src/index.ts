import app from "./app";
import { appConfig } from "./config/env";

app.listen(appConfig.port, () =>
  console.log(`Server running on port ${appConfig.port}`),
);
