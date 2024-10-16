import { Effect } from "effect";
import fs from "node:fs/promises";
import {
  CHECKPOINT_FILE,
  ERROR_MSG_SAVE_FAIL,
  SAVE_EVERY_NTH,
} from "../utils/const";
import { ShutdownFlag } from "../utils/utils";

export type Checkpoint = {
  lastSavedId: string;
  lastSavedDate: string;
  notionDbId: string;
};

export const createCheckpoint = (
  lastSavedDate: string,
  notionDbId: string,
  lastSavedId: string,
) =>
  Effect.gen(function* () {
    const checkpoint = {
      lastSavedDate: new Date(lastSavedDate).toISOString(),
      notionDbId,
      lastSavedId,
    };
    const result = yield* Effect.tryPromise({
      try: () =>
        fs
          .writeFile(CHECKPOINT_FILE, JSON.stringify(checkpoint))
          .then(
            () =>
              `Checkpoint saved: ${lastSavedDate} ${notionDbId} ${lastSavedId}`,
          ),
      catch: (e) => ERROR_MSG_SAVE_FAIL + (e as any).message,
    });
    yield* Effect.log(result);
  });

export const loadLastCheckpoint = () =>
  Effect.gen(function* () {
    const checkpointOption = Effect.tryPromise({
      try: async () => {
        const data = await fs.readFile(CHECKPOINT_FILE, "utf8");
        const checkpoint = JSON.parse(data);
        return checkpoint as Checkpoint;
      },
      catch: (e) => {
        return null;
      },
    });
    const checkpoint = yield* Effect.orElse(checkpointOption, () =>
      Effect.succeed(null),
    );
    return checkpoint;
  });
