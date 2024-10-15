import { Context, Effect, Schedule } from "effect";
import { Connection } from "jsforce";
import { BATCH_SIZE } from "../utils/const";

class SalesforceClient extends Context.Tag("SalesforceClient")<
  SalesforceClient,
  {
    login(username: string, password: string): Effect.Effect<Connection>;
  }
>() {}

const fetchSalesforce = Effect.gen(function* () {
  const salesforceService = yield* SalesforceClient;
  const salesforceClient = yield* salesforceService.login(
    process.env.SALESFORCE_LOGIN!,
    `${process.env.SALESFORCE_PASSWORD}${process.env.SALESFORCE_TOKEN}`,
  );
  return salesforceClient;
});

export const fetchFirstRecords = (client: Connection) =>
  Effect.retry(
    Effect.gen(function* () {
      const scheme = yield* Effect.promise(() =>
        client.sobject("Lead").describe(),
      );
      const fields = scheme.fields.map(({ name }) => name);
      const soql = `SELECT ${fields.join(", ")} FROM Lead`;
      const result = yield* Effect.promise(() =>
        client.query(`${soql} ORDER BY CreatedDate ASC`, {
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
    const result = yield* Effect.promise(
      async () =>
        await client.query(
          `${soqlQuery} ORDER BY CreatedDate ASC LIMIT ${BATCH_SIZE} OFFSET ${skip}`,
        ),
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
