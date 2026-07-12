import { config } from "dotenv";
import { resolve } from "path";

// Loaded via jest's `setupFiles`, which runs before any test file (and
// therefore before AppModule/ConfigModule) is imported — so these values
// are already in process.env by the time ConfigModule.forRoot reads them.
// dotenv does not overwrite keys already present in process.env, so this
// takes priority over apps/api/.env's dev values.
config({ path: resolve(__dirname, "../.env.test") });
