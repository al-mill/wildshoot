# Database Architecture

> **Rewritten 2026-10-13.** The first version chose RDS PostgreSQL on the belief that it was free tier. Measured against this account, it isn't (see Option 1). Free tier is a hard requirement, so the decision is now DynamoDB.

## Context

Wild Shoot needs persistent storage for user profiles, photo metadata, location data, and admin analytics. The key requirements that drive this decision:

- **Free tier — hard requirement.** Storage and compute must cost $0 indefinitely, not just for a 12-month or credit window (`spec.md`: "Built entirely on AWS free tier services").
- **Stay in AWS.** Provisioned and reproduced by CDK like the rest of the stack.
- **Admin analytics.** Upload counts per user, photo counts per location, a paginated gallery, and filtering by location (`spec.md`, admin features).
- **Lambda integration.** Works cleanly with functions that scale horizontally.

---

## Options Considered

### Option 1 — RDS PostgreSQL (rejected: not free)

Managed PostgreSQL on a micro instance. Full SQL suits the relational data and the analytics queries.

Measured 2026-10-13 (account 603013471428, us-west-2):

| Finding                                                                                             | Evidence                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db.t2.micro` can't run PostgreSQL at all                                                           | `describe-orderable-db-instance-options` returns no PostgreSQL versions for it. `db.t3.micro` and `db.t4g.micro` offer PG 11–18 and 12–18.                                                                                                      |
| The RDS free tier (750 h + 20 GB) is the legacy **12-month** offer, and this account doesn't get it | The account is a member of an AWS Organization, and AWS grants one free tier per payer account. S3 storage that the 12-month tier would cover is already billed at standard rates. Accounts opened since July 2025 get 6-month credits instead. |
| Without it, every hour bills                                                                        | `db.t4g.micro` $0.016/h (≈ $11.68/month). Storage $0.115/GB-month: 20 GB is $2.30; CDK's default 100 GiB is $11.50.                                                                                                                             |
| The VPC it needs isn't free either                                                                  | Lambdas in the VPC need interface endpoints (Secrets Manager, Cognito) at $0.01/h per AZ each (≈ $7.30/month), or a NAT gateway (≈ $32/month). The secret itself is $0.40/month.                                                                |
| Two stages double it                                                                                | Staging and production share the account. Even a 750 h allowance covers one instance.                                                                                                                                                           |

As built, that's ≈ $53/month per stage. **Fails the free-tier requirement.**

---

### Option 2 — DynamoDB (chosen)

AWS's managed key-value/document store.

**Free tier.** 25 GB storage, 25 WCU and 25 RCU each month. Per AWS pricing it is "per Region, per-payer account" and applies to **provisioned** capacity on the Standard table class. It does not expire. No VPC, no connection limit: each request is an independent HTTPS call authorised by the function's IAM role.

**Downside.** Analytics. DynamoDB has no ad-hoc aggregates, so every number the admin dashboard needs must be designed in up front, as a counter or an index (see Design below). A new analytics question means a new counter or index, not a new query.

---

### Option 3 — Neon Serverless Postgres (rejected: not AWS)

Postgres over HTTP, no VPC, scales to zero. Free tier: 0.5 GB storage, ~192 compute hours/month.

Rejected because it is an external vendor. CDK can't provision it, credentials are handled out-of-band, and the spec says "entirely on AWS".

---

## Decision

**Option 2 — DynamoDB, single-table design, provisioned capacity inside the free tier.**

It is the only option that is both free indefinitely and inside AWS. The analytics concern is handled by keeping counters up to date in the same transaction as each write, and by two GSIs for the gallery and the location filter. No Streams pipeline or aggregation tables are needed.

Choosing DynamoDB also removes the RDS-driven parts of the serverless ADR: VPC, interface endpoints, Secrets Manager, connection pooling and the reserved-concurrency connection budget.

---

## Design

### Table

One table per stage, `wildshoot-<stage>`, with keys `PK` / `SK` and two GSIs:

- `GSI1` (`GSI1PK` / `GSI1SK`) — type index: all photos, all users.
- `GSI2` (`GSI2PK` / `GSI2SK`) — location index.

Photo ids are ULIDs, so sorting by id sorts by upload time.

| Item             | PK           | SK                  | GSI1                          | GSI2                              | Attributes                                                                                            |
| ---------------- | ------------ | ------------------- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| User             | `USER#<sub>` | `PROFILE`           | `USERS` / `<createdAt>#<sub>` | —                                 | name, email, photoCount, createdAt                                                                    |
| Photo            | `USER#<sub>` | `PHOTO#<photoId>`   | `PHOTOS` / `<photoId>`        | `LOC#<locationKey>` / `<photoId>` | title, description, location, s3Key, status (`processing` / `ready` / `failed`), uploadedAt, userName |
| Location counter | `STATS`      | `LOC#<locationKey>` | —                             | —                                 | name, photoCount                                                                                      |
| Totals           | `STATS`      | `TOTALS`            | —                             | —                                 | users, photos                                                                                         |

Notes:

- `<sub>` is the Cognito user id, so no separate `cognito_id` mapping is needed.
- `<locationKey>` is the location name, trimmed and lower-cased.
- Admin rights come from the Cognito `admins` group only; there is no `isAdmin` attribute. The admin user list asks Cognito (`ListUsersInGroup`) which users are admins.

### Access patterns

| Need                                              | Operation                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List my photos, newest first                      | Query `PK = USER#<sub>`, `SK begins_with PHOTO#`, descending                                                                                                                                                    |
| Get / update / delete my photo                    | Get / Update / Delete on (`USER#<caller>`, `PHOTO#<id>`). The owner is part of the key, so another user's photo simply isn't found (404).                                                                       |
| Upload a photo                                    | One `TransactWriteItems`: put the photo; `ADD photoCount 1` on the user; `ADD photos 1` on totals; `ADD photoCount 1` on the location counter (created on first use)                                            |
| Delete a photo                                    | The same transaction with `-1`                                                                                                                                                                                  |
| Create a user (Cognito post-confirmation trigger) | Transaction: put the profile (`attribute_not_exists(PK)`), `ADD users 1` on totals                                                                                                                              |
| Admin gallery, newest first, paginated            | Query `GSI1PK = PHOTOS`, descending                                                                                                                                                                             |
| Admin filter by location                          | Query `GSI2PK = LOC#<locationKey>`, descending                                                                                                                                                                  |
| Admin stats                                       | Get totals. Query `PK = STATS`, `SK begins_with LOC#`, then sort by photoCount in the Lambda for the top locations (the number of distinct locations is small). Total locations = counters with photoCount > 0. |
| Admin user list with photo counts                 | Query `GSI1PK = USERS`                                                                                                                                                                                          |
| Admin delete user                                 | Query `PK = USER#<sub>`, delete the items in batches, decrement the counters, delete the S3 objects, then `AdminDeleteUser`                                                                                     |

All writes go through `lambda/_shared/ddb.ts`, so the counters can't be skipped by one handler. If they ever drift, a repair script rebuilds them from a scan.

### Capacity budget

The free tier's 25 WCU / 25 RCU is shared by every table and index in the region on the payer account, and staging and production both live in us-west-2. GSI capacity is billed as provisioned capacity, so it is budgeted in.

| Per stage       | RCU    | WCU    |
| --------------- | ------ | ------ |
| Table           | 5      | 5      |
| GSI1            | 4      | 4      |
| GSI2            | 3      | 3      |
| **Stage total** | **12** | **12** |
| **Both stages** | **24** | **24** |

- Fixed provisioned capacity, **no auto scaling** (it would scale past the free tier).
- Default AWS-owned encryption key (a customer-managed KMS key is $1/month).
- No point-in-time recovery or on-demand backups (both bill per GB). Production uses `RETAIN` and deletion protection instead.
- A CDK assertion test fails the build if a stage's provisioned capacity exceeds 12 / 12.

**What the cap means.** About 5 writes/s per stage sustained; DynamoDB also absorbs short bursts from up to 5 minutes of unused capacity. A transactional write costs double, and an upload transaction writes 4 items. That works out to roughly one upload every 1–2 seconds sustained, which is fine for the MVP. Beyond that, requests are throttled: the SDK retries, then the handler returns 429.

**Payer-account caveat.** The allowance belongs to the payer account of the Organization. If other accounts on the same payer use provisioned DynamoDB capacity in us-west-2, they share it. An SCP blocks the free-tier usage API, so this can't be checked from this account.

---

## Upgrade path

Every upgrade leaves the free tier, so each one needs an explicit decision. None of them is automatic.

| Trigger                                     | Action                                             | Cost                             |
| ------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| Sustained throttling                        | Raise provisioned capacity, or switch to on-demand | Per WCU/RCU-hour, or per request |
| An analytics question counters can't answer | Export to S3 + Athena                              | Per export and per query         |
| Need for backups                            | Point-in-time recovery                             | Per GB-month                     |

---

## References

- [DynamoDB pricing — provisioned capacity and free tier](https://aws.amazon.com/dynamodb/pricing/provisioned/)
- [DynamoDB single-table design (AWS blog)](https://aws.amazon.com/blogs/compute/creating-a-single-table-design-with-amazon-dynamodb/)
- [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html)
- [DynamoDB burst capacity](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/burst-adaptive-capacity.html)
- [Confirming eligibility for the AWS Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-eligibility.html)
- [Amazon RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/)
