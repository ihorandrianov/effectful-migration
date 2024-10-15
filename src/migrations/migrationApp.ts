import { Effect, Fiber, Queue, Schedule, Scope, Stream } from "effect";
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
import { BATCH_SIZE } from "../utils/const";

const makeNotionDb = (notionClient: Client) =>
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
              content: "New Lead Database",
            },
          },
        ],
        properties: {
          Name: {
            title: {},
          },
          Company: {
            rich_text: {},
          },
          Email: {
            email: {},
          },
          Phone: {
            phone_number: {},
          },
          Status: {
            select: {},
          },
          LeadSource: {
            select: {},
          },
          AnnualRevenue: {
            number: {},
          },
          NumberOfEmployees: {
            number: {},
          },
          CreatedDate: {
            date: {},
          },
          LastModifiedDate: {
            date: {},
          },
        },
      });
      return id;
    },
    catch: (error) => {
      Effect.log(`Failed creating db: ${error}`);
      return Effect.fail(`Database creation failed: ${(error as any).message}`);
    },
  });

const produceRecords = (queue: Queue.Queue<Lead>, client: Connection) =>
  Effect.gen(function* () {
    const [firstResults, soql] = yield* Effect.tap(
      fetchFirstRecords(client),
      (result) => Effect.log(result),
    );
    const total = firstResults.totalSize;
    let fetched = 1;
    yield* Effect.log(`Total records: ${total}`);
    yield* Effect.log(`Pushing ${fetched} ten records`);
    const leads = firstResults.records.map((record) => record as Lead);
    yield* queue.offerAll(leads);
    while (fetched * BATCH_SIZE < total) {
      const result = yield* fetchMoreRecords(
        client,
        soql,
        fetched * BATCH_SIZE,
      );
      fetched += 1;
      yield* Effect.log(`Pushing ${fetched} ten records`);
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
        yield* createPage(notionClient, notionPage);
        return value.CreatedDate;
      }),
    {
      concurrency: 2,
    },
  );

export const migrationApp = Effect.gen(function* () {
  const salesForceClient = yield* salesforce;

  const notionClient = yield* notion;
  const id = yield* Effect.tap(makeNotionDb(notionClient), Effect.log);

  const queue = yield* Queue.bounded<Lead>(BATCH_SIZE * 2);

  const mapSalesforceLeadToNotion = createTransformFunction(id);

  const fiber = yield* Effect.forkDaemon(
    produceRecords(queue, salesForceClient),
  );

  const stream = Stream.fromQueue(queue);

  const streamMapped = consumeRecords(
    stream,
    mapSalesforceLeadToNotion,
    notionClient,
  );

  yield* Stream.runForEach(streamMapped, (x) =>
    Effect.gen(function* () {
      yield* Effect.log(x);
    }),
  );

  yield* Fiber.await(fiber);
});
