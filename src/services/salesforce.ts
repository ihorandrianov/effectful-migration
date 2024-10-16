import { Context, Effect, Schedule } from "effect";
import { Connection } from "jsforce";
import { BATCH_SIZE } from "../utils/const";
import { Checkpoint } from "./checkpoint";

class SalesforceClient extends Context.Tag("SalesforceClient")<
  SalesforceClient,
  {
    login(username: string, password: string): Effect.Effect<Connection>;
  }
>() {}

const fetchSalesforce = Effect.gen(function* () {
  const salesforceService = yield* SalesforceClient;
  if (
    !process.env.SALESFORCE_LOGIN ||
    !process.env.SALESFORCE_PASSWORD ||
    !process.env.SALESFORCE_TOKEN
  ) {
    return yield* Effect.fail(
      "SALESFORCE_LOGIN or SALESFORCE_PASSWORD or SALESEFORCE_TOKEN is missing form ENV",
    );
  }
  const login = process.env.SALESFORCE_LOGIN;
  const password = `${process.env.SALESFORCE_PASSWORD}${process.env.SALESFORCE_TOKEN}`;

  const salesforceClient = yield* salesforceService.login(login, password);
  return salesforceClient;
});

export const fetchFirstRecords = (
  client: Connection,
  checkpoint: Checkpoint | null,
) =>
  Effect.retry(
    Effect.gen(function* () {
      const scheme = yield* Effect.promise(() =>
        client.sobject("Lead").describe(),
      );
      const fields = scheme.fields.map(({ name }) => name);

      const soql = checkpoint
        ? `SELECT ${fields.join(", ")} FROM Lead WHERE Id > '${checkpoint.lastSavedId}'`
        : `SELECT ${fields.join(", ")} FROM Lead`;
      const result = yield* Effect.promise(() =>
        client.query(`${soql} ORDER BY Id ASC`, {
          autoFetch: true,
          maxFetch: BATCH_SIZE,
        }),
      );
      return [result, soql] as const;
    }),
    {
      times: 5,
      schedule: Schedule.exponential(100),
    },
  );

export const fetchMoreRecords = (
  client: Connection,
  soqlQuery: string,
  skip: number,
) =>
  Effect.gen(function* () {
    const result = yield* Effect.retry(
      Effect.tryPromise({
        try: async () =>
          await client.query(
            `${soqlQuery} ORDER BY Id ASC LIMIT ${BATCH_SIZE} OFFSET ${skip}`,
          ),
        catch: (error) => {
          Effect.runSync(Effect.log("Failed to fetch more records"));
          return error;
        },
      }),
      {
        times: 3,
        schedule: Schedule.exponential(100),
      },
    );
    return result;
  });

export const salesforce = fetchSalesforce.pipe(
  Effect.provideService(SalesforceClient, {
    login: (username, password) =>
      Effect.promise(async () => {
        const connection = new Connection();
        await connection.login(username, password);

        return connection;
      }),
  }),
);
