import { Effect, Fiber } from "effect";

import "dotenv/config";
import { migrationApp } from "./migrations/migrationApp";

Effect.runPromise(migrationApp);
