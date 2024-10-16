# Salesforce to Notion Migration App

This application is responsible for migrating records from Salesforce to Notion using a combination of Salesforce APIs, Notion APIs, and the `effect` library to handle side effects, concurrency, and error handling. The app supports checkpointing, so it can resume from the last successfully processed record in case of interruptions.

## How to run
1. Run `npm install`
2. Run `cp .env.example .env` and fill it up
3. Run `npm run start`

## General Flow

1. **Initialization:**
   - The app starts by loading the last known checkpoint, which contains information about the last processed Salesforce record and the Notion database being used.
   - Salesforce and Notion clients are initialized for interacting with their respective APIs.

2. **Queue Setup:**
   - A bounded queue is created to hold Salesforce leads fetched from the Salesforce API. The size of the queue is defined by `BATCH_SIZE * 2`.

3. **Notion Database Setup:**
   - If the app is running for the first time or no checkpoint exists, a new Notion database is created using the `makeNotionDb` function. The database stores the Salesforce leads mapped to Notion pages.
   - The database is created with a defined title and properties, and its ID is saved for future reference.

4. **Record Production (Fetching Salesforce Records):**
   - The `produceRecords` function is responsible for fetching Salesforce leads using the Salesforce API.
   - It first fetches a batch of records (`fetchFirstRecords`), logs the total number of records, and pushes the leads into the queue.
   - It continues fetching additional records in batches (using pagination) and pushes them into the queue until all records are fetched.

5. **Record Consumption (Creating Notion Pages):**
   - The `consumeRecords` function processes the leads stored in the queue. It maps each Salesforce lead to a Notion page using a custom transformation function (`mapSalesforceLeadToNotion`).
   - For each lead:
     - A Notion page is created in the previously created Notion database.
     - A checkpoint is saved containing information about the last processed lead (date, database ID, and Salesforce record ID) to ensure that the process can be resumed in case of failure.
   - The Notion page creation and checkpoint saving are done concurrently to optimize performance.

6. **Concurrency Management:**
   - The app leverages `Stream` and `Effect` to handle concurrent record processing and queue management:
     - A stream is created from the queue, which continuously consumes records as they are added by the producer.
     - The app processes records concurrently, with a maximum number of concurrent Notion writes controlled by the `NOTION_WRITE_CONCURRENCY` constant.

7. **Completion and Graceful Shutdown:**
   - After all records are processed, the queue is shut down and the application logs that the migration is complete.
   - The producer fiber (which is responsible for fetching Salesforce records) is awaited to ensure that it completes before the app shuts down.

## Key Components

- **Checkpointing:**
  - The checkpointing system allows the migration to resume from the last successfully processed Salesforce record. This is critical for ensuring that large migrations can continue even if interrupted.

- **Effect and Stream:**
  - The `effect` library is used throughout to manage side effects, asynchronous operations, and concurrency. This ensures that the app's logic remains pure and that effects are explicitly managed.
  - `Stream` allows for consuming records from a queue in a controlled manner, enabling concurrent processing with backpressure.

- **Error Handling:**
  - Errors during Notion database creation or record processing are caught and logged, ensuring that failures are visible and the app can fail gracefully when necessary.

## Areas Of Improvement

1. **Logging and Monitoring:**
   Improve logging by adding more detailed, structured logs with timestamps and metadata for better debugging and performance insights.

2. **Concurrency and Rate Limiting:**
   Fine-tune concurrency based on Notion's API limits. Consider batching writes to optimize performance and avoid hitting rate limits.

3. **Graceful Shutdown:**
   Improve shutdown handling to ensure all in-progress tasks are completed when the app is interrupted, for a more resilient execution.

4. **Testing and Benchmarking:**
   Increase test coverage and benchmark performance to optimize batch sizes and concurrency settings for different dataset sizes.


## Summary

The app handles the entire process of migrating Salesforce records to Notion in an efficient and fault-tolerant manner. By leveraging concurrency, queues, and checkpointing, it can manage large data volumes and resume after interruptions, making it a robust solution for data migration between two platforms.
