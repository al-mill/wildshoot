# Serverless Architecture — Lambda Implementation

## Context

The API ADR established that we use AWS Lambda + API Gateway. This document covers the implementation decisions: how Lambda functions are structured, bundled, deployed, and operated. The key constraints are the AWS free tier, which is a hard requirement (Lambda: 1M requests/month, 400,000 GB-seconds compute); a DynamoDB table on free-tier provisioned capacity (see the database ADR); and the need for a local development workflow that doesn't require AWS credentials.

**Amended 2026-10-13:** the database moved from RDS PostgreSQL to DynamoDB because RDS isn't free on this account. Everything RDS forced on this design is gone: the VPC, interface endpoints, Secrets Manager, connection pooling and the reserved-concurrency connection budget. Paid options (provisioned concurrency) are removed too.

---

## Runtime & Toolchain

**Node.js 24.x + TypeScript** (amended 2026-10-09: Lambda deprecated `nodejs20.x` on 2026-04-30; `nodejs24.x` is supported to 2028-04-30)

- Consistent with the Nuxt frontend — same language, same types, shared `types/index.ts`
- esbuild bundling via CDK's `NodejsFunction` construct: fast builds, tree shaking, single-file output per function
- Each Lambda bundle targets < 1 MB to minimise cold start unzip time

**CDK construct:**

```typescript
new NodejsFunction(this, 'PhotosUpload', {
  entry: 'lambda/photos/upload.ts',
  handler: 'handler',
  runtime: Runtime.NODEJS_24_X,
  bundling: {
    minify: true,
    sourceMap: true,
    externalModules: ['@aws-sdk/*'], // already in Lambda runtime
  },
});
```

---

## Project Structure

```
lambda/
├── _shared/
│   ├── auth.ts        # Bearer token parsing
│   ├── cognito.ts     # Cognito client + error mapping
│   ├── ddb.ts         # DynamoDB document client, keys and counter transactions
│   ├── env.ts         # Required env var lookup
│   ├── request.ts     # JSON body parsing
│   └── response.ts    # Standard API Gateway response helpers
├── authorizers/
│   └── cognito.ts     # JWT validation — runs before every protected route
├── auth/
│   ├── login.ts
│   ├── refresh.ts
│   └── logout.ts
├── photos/
│   ├── upload.ts
│   ├── list.ts
│   ├── get.ts
│   ├── update.ts
│   ├── delete.ts
│   └── process.ts     # S3-triggered — resize + optimise
├── admin/
│   ├── stats.ts
│   └── users.ts
└── triggers/
    └── post-confirmation.ts  # Cognito trigger — creates the user item
```

Shared code in `lambda/_shared/` is inlined by esbuild into each bundle — no Lambda Layer needed for application code. Layers are reserved for large binary dependencies (e.g. sharp for image processing).

---

## Database Access

**Amended 2026-10-13.** This section replaces "Database Connection Management", which covered:

- RDS's ~112-connection ceiling;
- RDS Proxy;
- the reserved-concurrency connection budget;
- PgBouncer;
- pool hygiene.

None of it applies to DynamoDB.

Every handler reaches DynamoDB with one module-scope document client from `lambda/_shared/ddb.ts`. Each request is an independent HTTPS call signed with the function's IAM role. There are no TCP connections to pool, no connection ceiling and no credentials.

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requireEnv } from './env';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const tableName = requireEnv('TABLE_NAME');
```

The client is created once per instance and reused across warm invocations.

### The new limit: provisioned capacity

Throughput is capped by the free-tier capacity budget in the database ADR (12 RCU / 12 WCU per stage), not by connections.

When a burst exceeds it:

1. DynamoDB throttles.
2. The SDK retries with backoff.
3. If retries run out, the handler returns **429** (not a 500, not a hang).

No reserved concurrency is needed for the database. Lambda's own free tier (1M requests, 400,000 GB-seconds) is the other ceiling.

### Throttling test

`test/load/throttling.ts` runs manually against staging only, never production, and never in the standard test run.

It fires a burst of uploads well beyond the stage's 12 WCU and checks that:

- every response is 201 or 429; nothing is a 5xx or a timeout;
- throttled responses come back fast;
- the counters (`STATS#TOTALS`, the location counter, the user's `photoCount`) match the number of photos actually written.

---

## No VPC

**Amended 2026-10-13.** This section replaces "VPC Configuration". A VPC was only needed to reach RDS.

All functions now run outside a VPC and reach DynamoDB, S3 and Cognito over their public HTTPS endpoints with IAM. That keeps three paid items off the bill:

| Avoided                                        | Cost (us-west-2)                   |
| ---------------------------------------------- | ---------------------------------- |
| NAT gateway                                    | ≈ $32/month                        |
| Interface endpoints (Cognito, Secrets Manager) | $0.01/h per AZ each, ≈ $7.30/month |
| Secrets Manager secret                         | $0.40/month                        |

---

## Cold Start Strategy

Cold starts happen when a new Lambda instance is created. For Node.js 24 with a < 1 MB bundle, a cold start is typically 200–400 ms.

**Mitigations:**

| Approach                           | Applied to               | Cost |
| ---------------------------------- | ------------------------ | ---- |
| Small bundles (< 1 MB via esbuild) | All functions            | Free |
| Lazy-init heavy dependencies       | `photos/process` (sharp) | Free |

**Amended 2026-10-13:** provisioned concurrency for the authorizer and `photos/upload` is dropped. It bills for every hour it's configured, used or not, so it breaks the free tier. Those cold starts are accepted.

We do **not** use scheduled keep-warm pings — they mask the real cold start behaviour and make load testing unreliable.

---

## Secrets & Configuration

| Type                                    | Storage                                   | Access pattern                             |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| Config (region, table and bucket names) | SSM Parameter Store (standard tier, free) | Injected as env vars by CDK at deploy time |
| Cognito public keys                     | In-memory cache                           | Fetched at cold start, refreshed every 24h |

CDK injects SSM values at deploy time so Lambda functions receive plain env vars — no SDK calls needed for non-secret config.

There are no database credentials. Each function's IAM role grants it access to the table (amended 2026-10-13; this replaces Secrets Manager at $0.40 per secret per month).

---

## Image Processing Pipeline

Photo upload is split into two Lambda functions to keep the upload response fast:

```
POST /api/photos
    ↓
photos/upload.ts          (sync — validates, stores original to S3, writes the photo item + counters)
    ↓ S3 PutObject event
photos/process.ts         (async — generates thumbnail, webp version, updates the item's status)
```

`photos/process.ts` uses a Lambda Layer containing the `sharp` binary (platform-specific, must be compiled for `linux/arm64` or `linux/x86_64` to match Lambda's runtime environment).

The photo item is written with `status: 'processing'` on upload and updated to `status: 'ready'` once processing completes. The frontend polls or the UI shows a processing indicator.

---

## Local Development

Lambda functions are plain TypeScript modules — they can be unit tested without AWS. The integration test strategy:

| Layer       | Tool                          | What it tests                                                      |
| ----------- | ----------------------------- | ------------------------------------------------------------------ |
| Unit        | Vitest + mocks                | Business logic, validation, DynamoDB keys and transaction contents |
| Integration | Deploy to staging via CDK     | End-to-end with real DynamoDB, S3, Cognito                         |
| Load        | Custom harness (`test/load/`) | Capacity throttling returns 429, counters stay consistent          |

There is no local Lambda emulator in the plan. AWS SAM Local adds setup overhead and drifts from the real Lambda environment. It's faster to write thorough unit tests and use the staging stack for integration checks.

---

## Deployment via CDK

Each Lambda function is a `NodejsFunction` construct defined in `cdk/lib/stacks/wildshoot-stack.ts`. The API Gateway routes are wired in the same stack.

Functions share:

- A single IAM role per function group (auth, photos, admin) — least-privilege; table access via `table.grantReadData` / `grantReadWriteData` per group
- `TABLE_NAME` as an env var
- A Lambda Layer for `sharp` (image processing only)
- Environment variables injected from SSM at synth time via `ssm.StringParameter.valueForStringParameter()`

Deployment is atomic: `cdk deploy` updates all functions and the API Gateway stage in one operation. Rollback is `cdk deploy` from the previous commit.

---

## Success Criteria

- All Lambda bundles < 1 MB (verified in CI with `du`)
- Cold start p99 < 500 ms for all functions (measured in CloudWatch)
- Throttling test passes: requests over the capacity budget get a 429, never a 5xx or a hang
- Provisioned DynamoDB capacity per stage ≤ 12 RCU / 12 WCU (asserted in a CDK test)
- Nothing in the stack bills by the hour (no VPC endpoints, NAT, RDS or provisioned concurrency)
- Staging deploy completes in < 3 minutes
- No credentials or secrets in source code or CDK assets

---

## References

### AWS Lambda

- [Lambda best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Managing concurrency — reserved and provisioned](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
- [Lambda performance optimisation (AWS blog)](https://aws.amazon.com/blogs/compute/operating-lambda-performance-optimization-part-1/)

### DynamoDB

- [DynamoDB pricing — provisioned capacity and free tier](https://aws.amazon.com/dynamodb/pricing/provisioned/)
- [DynamoDB document client (AWS SDK v3)](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/)
- [Throttling and retries in DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html#Programming.Errors.RetryAndBackoff)

### CDK

- [NodejsFunction construct (aws-cdk-lib)](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html)
- [TableV2 construct (aws-cdk-lib)](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb.TableV2.html)
