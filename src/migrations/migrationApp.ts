import { Effect, Fiber, Queue, Stream } from "effect";
import {
  fetchFirstRecords,
  fetchMoreRecords,
  salesforce,
} from "../services/salesforce";
import { Lead } from "../models/salesforce";

import { createTransformFunction } from "../transformers/salesforceToNotion";
import { createPage, notion } from "../services/notion";
import { NotionLeadPage } from "../models/notion";
import { Client } from "@notionhq/client";
import { Connection } from "jsforce";
import {
  BATCH_SIZE,
  NOTION_DATABASE_PROPERTIES,
  NOTION_DATABASE_TITLE,
  NOTION_WRITE_CONCURENCY,
} from "../utils/const";
import {
  Checkpoint,
  createCheckpoint,
  loadLastCheckpoint,
} from "../services/checkpoint";
import { makeSdFlag } from "../utils/utils";

const makeNotionDb = (
  notionClient: Client,
  databaseTitle: string,
  properties: any,
) =>
  Effect.tryPromise({
    try: async () => {
      const { id } = await notionClient.databases.create({
        parent: {
          page_id: process.env.NOTION_PAGE_ID!,
        },
        title: [
          {
            type: "text",
            text: {
              content: databaseTitle,
            },
          },
        ],
        properties,
      });
      return id;
    },
    catch: (error) => {
      Effect.log(`Failed creating db: ${error}`);
      return Effect.fail(`Database creation failed: ${(error as any).message}`);
    },
  });

const produceRecords = (
  queue: Queue.Queue<Lead>,
  client: Connection,
  checkpoint: Checkpoint | null,
) =>
  Effect.gen(function* () {
    const [firstResults, soql] = yield* Effect.tap(
      fetchFirstRecords(client, checkpoint),
      (result) => Effect.log(result),
    );
    const total = firstResults.totalSize;
    let fetched = 1;
    yield* Effect.log(`Total records: ${total}`);
    yield* Effect.log(`Pushing ${fetched}: ${BATCH_SIZE} records`);
    const leads = firstResults.records.map((record) => record as Lead);
    yield* queue.offerAll(leads);
    while (fetched * BATCH_SIZE < total) {
      const result = yield* fetchMoreRecords(
        client,
        soql,
        fetched * BATCH_SIZE,
      );
      fetched += 1;
      yield* Effect.log(`Pushing ${fetched}: ${BATCH_SIZE} records`);
      const leads = result.records.map((record) => record as Lead);
      yield* queue.offerAll(leads);
    }
  });

const consumeRecords = (
  stream: Stream.Stream<Lead>,
  mappingFunction: (lead: Lead) => NotionLeadPage,
  notionClient: Client,
) =>
  Stream.mapEffect(
    stream,
    (value) =>
      Effect.gen(function* () {
        const notionPage = mappingFunction(value);
        yield* Effect.log(`Creating page for : ${value.Name}`);
        const handle = yield* Effect.forkAll([
          createPage(notionClient, notionPage),
          createCheckpoint(
            value.CreatedDate,
            notionPage.parent.database_id,
            value.Id,
          ),
        ]);

        yield* handle.await;
        return {
          lastSavedDate: value.CreatedDate,
          notionDbId: notionPage.parent.database_id,
          lastSavedId: value.Id,
        };
      }),
    {
      concurrency: NOTION_WRITE_CONCURENCY,
    },
  );

export const migrationApp = Effect.gen(function* () {
  const checkpoint = yield* loadLastCheckpoint();
  const shutdownFlag = yield* makeSdFlag;

  const salesForceClient = yield* salesforce;
  const notionClient = yield* notion;

  const queue = yield* Queue.bounded<Lead>(BATCH_SIZE * 2);

  const id = checkpoint
    ? checkpoint.notionDbId
    : yield* Effect.tap(
        makeNotionDb(
          notionClient,
          NOTION_DATABASE_TITLE,
          NOTION_DATABASE_PROPERTIES,
        ),
        Effect.log,
      );

  const mapSalesforceLeadToNotion = createTransformFunction(id);

  const fiber = yield* Effect.forkDaemon(
    produceRecords(queue, salesForceClient, checkpoint),
  );

  const stream = Stream.fromQueue(queue, {
    shutdown: true,
  });

  const streamMapped = consumeRecords(
    stream,
    mapSalesforceLeadToNotion,
    notionClient,
  );

  yield* Stream.runDrain(streamMapped);
  yield* Queue.shutdown(queue);
  yield* Effect.log("Complete");

  yield* Fiber.await(fiber);
});
