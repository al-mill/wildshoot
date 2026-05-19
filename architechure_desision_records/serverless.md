# Serverless Architecture — Lambda Implementation

## Context

The API ADR established that we use AWS Lambda + API Gateway. This document covers the implementation decisions: how Lambda functions are structured, bundled, deployed, and operated. The key constraints are the AWS free tier (1M requests/month, 400,000 GB-seconds compute), a PostgreSQL database on t2.micro with a hard `max_connections` ceiling of ~112 total (each Lambda instance holds one connection), and the need for a local development workflow that doesn't require AWS credentials.

---

## Runtime & Toolchain

**Node.js 20.x + TypeScript**

- Consistent with the Nuxt frontend — same language, same types, shared `types/index.ts`
- esbuild bundling via CDK's `NodejsFunction` construct: fast builds, tree shaking, single-file output per function
- Each Lambda bundle targets < 1 MB to minimise cold start unzip time

**CDK construct:**

```typescript
new NodejsFunction(this, 'PhotosUpload', {
  entry: 'lambda/photos/upload.ts',
  handler: 'handler',
  runtime: Runtime.NODEJS_20_X,
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
│   ├── db.ts          # RDS connection pool (singleton)
│   ├── response.ts    # Standard API Gateway response helpers
│   └── types.ts       # Lambda-specific types (event shapes, etc.)
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
└── admin/
    ├── stats.ts
    └── users.ts
```

Shared code in `lambda/_shared/` is inlined by esbuild into each bundle — no Lambda Layer needed for application code. Layers are reserved for large binary dependencies (e.g. sharp for image processing).

---

## Database Connection Management

### The Problem

Lambda scales horizontally — at 100 concurrent requests, 100 Lambda instances each try to open a connection. RDS PostgreSQL on t2.micro (1 GB RAM) has a hard `max_connections` of ~112 (calculated as `DBInstanceClassMemory / 9531392`). This is the highest-risk constraint in the architecture.

### Connection saturation test harness

We need a load test that fires > 112 simultaneous requests at the API to verify the system fails gracefully (queues or returns a fast error) rather than silently hanging. This lives in `test/load/connection-saturation.ts` and runs as part of the staging smoke test suite.

**What to verify:**

- Requests beyond the cap receive a `429 Too Many Requests` from API Gateway (not a 500, not a timeout)
- Response time for throttled requests is fast (< 200 ms) — they should be rejected immediately, not held open
- Requests within the cap continue to succeed with normal latency during the overload
- No DB connections leak — connection count on RDS returns to baseline after load subsides

**Rough structure (`test/load/connection-saturation.ts`):**

```typescript
const CONCURRENCY = 150; // safely above our 90-connection budget
const ENDPOINT = process.env.STAGING_API_URL + '/api/photos';

const results = await Promise.allSettled(
  Array.from({ length: CONCURRENCY }, () =>
    fetch(ENDPOINT, { headers: { Authorization: `Bearer ${testToken}` } })
  )
);

const statuses = results.map(r =>
  r.status === 'fulfilled' ? r.value.status : 'error'
);
const throttled = statuses.filter(s => s === 429).length;
const succeeded = statuses.filter(s => s === 200).length;
const errors = statuses.filter(s => s !== 429 && s !== 200).length;

console.table({ succeeded, throttled, errors });

// Assertions
assert(
  errors === 0,
  'No requests should result in unhandled errors or timeouts'
);
assert(throttled > 0, 'Some requests must be throttled once limit is exceeded');
assert(
  succeeded <= 90,
  'Successes must not exceed reserved concurrency budget'
);
```

This runs against the staging stack only — never production. It is a manual trigger in CI, not part of the standard test run.

### If cost weren't a constraint: RDS Proxy

**RDS Proxy** sits between Lambda and RDS and multiplexes thousands of Lambda connections down to the actual connection limit. It's the purpose-built AWS solution.

```
Lambda (N instances) → RDS Proxy → RDS PostgreSQL (~112 connections)
```

Cost: ~$0.015/hour ≈ **$11/month**. Not free tier — ruled out for now.

---

### Free tier options

#### Option A — Reserved concurrency cap (chosen for now)

Set a **reserved concurrency limit** on each Lambda function group so the total number of concurrent instances can never exceed a safe connection budget.

```
photos/* functions:  reserved concurrency 40
admin/* functions:   reserved concurrency 20
auth/* functions:    reserved concurrency 20
authorizer:          reserved concurrency 10
─────────────────────────────────────────────
Total max connections:                     90  (under the ~112 limit)
```

Requests beyond the concurrency cap are throttled by API Gateway (429). The upside: zero cost, zero new infrastructure, the limit is explicit and visible in the CDK stack. The downside: throughput is capped. Fine for MVP scale.

Each Lambda function still uses `max: 1` in the pg pool so one instance holds at most one connection:

```typescript
import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: 5432,
      max: 1,
      idleTimeoutMillis: 5_000, // release quickly between warm invocations
      connectionTimeoutMillis: 3_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}
```

The pool singleton is reused across warm invocations. On cold start a new pool is created.

---

#### Option B — PgBouncer on a free-tier EC2 t2.micro

Run **PgBouncer** (a lightweight Postgres connection pooler) on a t2.micro EC2 instance in the same VPC. Lambda functions connect to PgBouncer, which pools down to RDS.

```
Lambda (N instances) → PgBouncer (t2.micro) → RDS PostgreSQL
```

The free tier includes 750 EC2 hours/month — enough to run one t2.micro 24/7 at no charge for 12 months.

Upside: lifts the concurrency cap, closer to what RDS Proxy provides.
Downside: PgBouncer becomes a single point of failure. Needs basic monitoring. The free tier clock runs out after 12 months.

---

#### Option C — Aggressive connection hygiene (no new infrastructure)

Skip the concurrency cap and instead tune the pool to release connections as fast as possible, reducing the window where many instances hold connections simultaneously:

- `max: 1` — one connection per Lambda instance
- `idleTimeoutMillis: 500` — release after half a second idle
- `allowExitOnIdle: true` — pg driver tears down the pool when idle
- Short Lambda timeout (10s) so stuck connections don't linger

This works well at low-to-moderate traffic but offers no hard guarantee under burst load. It's a good complement to Option A but not sufficient on its own.

---

### Recommendation

**Option A + Option C combined.**

Option B (PgBouncer on EC2) trades one operational concern for another — a new server to patch, monitor, and keep alive. Wrong trade for an MVP. Option C alone offers no hard guarantee under burst; it's good hygiene but not a ceiling.

Option A is the right foundation: the concurrency limits are explicit in CDK, visible in code review, and produce a clean 429 rather than a hung connection when breached. Layer Option C's pool settings on top regardless — short idle timeouts and `allowExitOnIdle` cost nothing and reduce connection dwell time.

**Upgrade path:** when real traffic data shows we're regularly hitting the 429 ceiling and it's affecting users, that's the moment RDS Proxy at $11/month is obviously worth it. We'll have the data to justify it rather than paying speculatively.

---

## VPC Configuration

Lambda functions that connect to RDS must run inside the same VPC. This has one important side effect: **Lambda functions in a VPC have no internet access by default**.

Functions that need to call external services (Cognito JWKS endpoint for JWT validation, S3) must either:

- Use VPC endpoints (S3 Gateway endpoint is free; Cognito Interface endpoint costs ~$7/month)
- Or route through a NAT Gateway (~$32/month — too expensive for free tier)

**Decision:** Use VPC endpoints for S3 (free) and Cognito. The Lambda Authorizer validates JWTs offline using the cached Cognito public keys rather than calling the JWKS endpoint on every request.

```
VPC
├── Private subnets (Lambda + RDS)
│   ├── Lambda functions
│   └── RDS PostgreSQL
└── VPC Endpoints
    ├── S3 Gateway endpoint (free)
    └── Cognito Interface endpoint (~$7/month, needed for user pool operations)
```

---

## Cold Start Strategy

Cold starts happen when a new Lambda instance is created. For Node.js 20 with a < 1 MB bundle, a cold start is typically 200–400 ms. Acceptable for most routes; not acceptable for login.

**Mitigations:**

| Approach                                         | Applied to                          | Cost        |
| ------------------------------------------------ | ----------------------------------- | ----------- |
| Small bundles (< 1 MB via esbuild)               | All functions                       | Free        |
| Provisioned concurrency (1 instance always warm) | Cognito Authorizer, `photos/upload` | ~$1–2/month |
| Lazy-init heavy dependencies                     | `photos/process` (sharp)            | Free        |

We do **not** use scheduled keep-warm pings — they mask the real cold start behaviour and make load testing unreliable.

---

## Secrets & Configuration

| Type                                | Storage                         | Access pattern                               |
| ----------------------------------- | ------------------------------- | -------------------------------------------- |
| DB credentials                      | AWS Secrets Manager             | Fetched once at cold start, cached in memory |
| Config (region, bucket names, etc.) | SSM Parameter Store (free tier) | Injected as env vars by CDK at deploy time   |
| Cognito public keys                 | In-memory cache                 | Fetched at cold start, refreshed every 24h   |

CDK injects SSM values at deploy time so Lambda functions receive plain env vars — no SDK calls needed for non-secret config.

---

## Image Processing Pipeline

Photo upload is split into two Lambda functions to keep the upload response fast:

```
POST /api/photos
    ↓
photos/upload.ts          (sync — validates, stores original to S3, writes DB row)
    ↓ S3 PutObject event
photos/process.ts         (async — generates thumbnail, webp version, updates DB)
```

`photos/process.ts` uses a Lambda Layer containing the `sharp` binary (platform-specific, must be compiled for `linux/arm64` or `linux/x86_64` to match Lambda's runtime environment).

The DB row is written with `status: 'processing'` on upload and updated to `status: 'ready'` once processing completes. The frontend polls or the UI shows a processing indicator.

---

## Local Development

Lambda functions are plain TypeScript modules — they can be unit tested without AWS. The integration test strategy:

| Layer       | Tool                          | What it tests                                     |
| ----------- | ----------------------------- | ------------------------------------------------- |
| Unit        | Vitest + mocks                | Business logic, validation, DB query construction |
| Integration | Deploy to staging via CDK     | End-to-end with real RDS, S3, Cognito             |
| Load        | Custom harness (`test/load/`) | Connection saturation, concurrency limits         |

There is no local Lambda emulator in the plan. AWS SAM Local adds setup overhead and drifts from the real Lambda environment. It's faster to write thorough unit tests and use the staging stack for integration checks.

---

## Deployment via CDK

Each Lambda function is a `NodejsFunction` construct defined in `cdk/lib/stacks/wildshoot-stack.ts`. The API Gateway routes are wired in the same stack.

Functions share:

- A single IAM role per function group (auth, photos, admin) — least-privilege
- A Lambda Layer for `sharp` (image processing only)
- Environment variables injected from SSM at synth time via `ssm.StringParameter.valueForStringParameter()`

Deployment is atomic: `cdk deploy` updates all functions and the API Gateway stage in one operation. Rollback is `cdk deploy` from the previous commit.

---

## Success Criteria

- All Lambda bundles < 1 MB (verified in CI with `du`)
- Cold start p99 < 500 ms for all functions (measured in CloudWatch)
- DB connection saturation test passes: > 112 concurrent requests handled without silent hang
- Staging deploy completes in < 3 minutes
- No credentials or secrets in source code or CDK assets

---

## References

### AWS Lambda

- [Lambda best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Managing concurrency — reserved and provisioned](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
- [Configuring a Lambda function to access resources in a VPC](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)
- [Lambda performance optimisation (AWS blog)](https://aws.amazon.com/blogs/compute/operating-lambda-performance-optimization-part-1/)

### Database connections

- [Using Amazon RDS Proxy with Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-database.html)
- [Amazon RDS Proxy — concepts and terminology](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
- [node-postgres Pool API](https://node-postgres.com/apis/pool)
- [PgBouncer documentation](https://www.pgbouncer.org/config.html)

### CDK

- [NodejsFunction construct (aws-cdk-lib)](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html)
- [Configuring reserved concurrency with CDK](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda.Function.html#reservedconcurrentexecutions)
