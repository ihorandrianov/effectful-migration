import { Context, Effect, Schedule } from "effect";
import { Client } from "@notionhq/client";
import { NotionLeadPage } from "../models/notion";

class NotionClient extends Context.Tag("NotionClient")<
  NotionClient,
  {
    login(apiKey: string): Effect.Effect<Client>;
  }
>() {}

const initNotion = Effect.gen(function* () {
  const notionService = yield* NotionClient;
  const notionClient = yield* notionService.login(process.env.NOTION_API_KEY!);
  yield* Effect.log("Notion initiated");
  return notionClient;
});

export const createPage = (client: Client, page: NotionLeadPage) =>
  Effect.retry(
    Effect.tryPromise({
      try: async () => {
        await client.pages.create(page as any);
      },
      catch: (e) => {},
    }),
    {
      times: 3,
      schedule: Schedule.exponential(100),
    },
  );

export const notion = initNotion.pipe(
  Effect.provideService(NotionClient, {
    login: (token) =>
      Effect.promise(async () => {
        const client = new Client({
          auth: process.env.NOTION_TOKEN,
        });
        return client;
      }),
  }),
);
