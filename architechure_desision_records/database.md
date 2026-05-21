# Database Architecture

## Context

Wild Shoot needs persistent storage for user profiles, photo metadata, location data, and admin analytics. The key requirements that drive this decision:

- **Analytics queries** — admin dashboard needs aggregate counts per user, location-based stats, and filtered pagination. These are inherently relational.
- **Lambda integration** — the database must work cleanly with serverless functions that scale horizontally and hold connections briefly.
- **Free tier** — storage and compute must stay within AWS (or equivalent) free tier for the MVP.
- **Schema** — four core tables: `users`, `photos`, `locations` (normalised from photo metadata), `sessions` (if not fully delegated to Cognito).

---

## Options Considered

### Option 1 — RDS PostgreSQL on t2.micro

Managed PostgreSQL running on AWS RDS. The t2.micro instance is included in the free tier (750 hours/month, 20 GB storage, automated backups).

**Schema fits naturally:**

```sql
users        (id, cognito_id, name, email, created_at)
photos       (id, user_id, s3_key, title, description, status, uploaded_at)
locations    (id, photo_id, name, lat, lng)
```

Analytics queries are straightforward SQL:

```sql
-- Upload counts per user
SELECT u.name, COUNT(p.id) AS photo_count
FROM users u LEFT JOIN photos p ON p.user_id = u.id
GROUP BY u.id ORDER BY photo_count DESC;

-- Top locations
SELECT l.name, COUNT(*) AS count
FROM locations l JOIN photos p ON p.id = l.photo_id
WHERE p.status = 'ready'
GROUP BY l.name ORDER BY count DESC LIMIT 10;
```

**Upsides:** Full SQL, natural fit for relational data and analytics, well-understood operational model, free tier, stays entirely within AWS.

**Downsides:** Connection limit (~112 on t2.micro) requires the mitigation strategy from the serverless ADR. Lives in a VPC, adding networking complexity.

---

### Option 2 — DynamoDB

AWS's managed NoSQL key-value/document store. Free tier is permanent: 25 GB storage, 25 WCU/RCU (enough for ~200M requests/month at 1 KB items). No connection limits — each request is an independent HTTP call, no TCP pool to manage.

**Single-table design for core access patterns:**

```
PK                    SK                  Attributes
USER#<id>             PROFILE             name, email, created_at
USER#<id>             PHOTO#<photo_id>    title, s3_key, status, location, uploaded_at
```

**Upsides:** No connection limit problem at all — eliminates the entire serverless connection management concern. Scales infinitely. Free tier never expires.

**Downsides:** Analytics queries are painful. Aggregate counts, multi-dimensional filtering, and pagination require either: (a) maintaining separate aggregation tables updated via DynamoDB Streams + Lambda, or (b) expensive full-table scans. The admin dashboard's requirements map badly to DynamoDB's access-pattern-first design. Migrating later if requirements grow is costly.

---

### Option 3 — Neon Serverless Postgres

Neon is a managed PostgreSQL service built specifically for serverless environments. It uses an HTTP-based connection driver (`@neondatabase/serverless`) instead of TCP, which means no connection pool, no connection limit, and no VPC required. Lambda functions make standard SQL queries over HTTP.

Free tier: 0.5 GB storage, ~192 compute hours/month (scales to zero when idle).

```typescript
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const photos = await sql`SELECT * FROM photos WHERE user_id = ${userId}`
```

**Upsides:** Full PostgreSQL compatibility (same schema and queries as Option 1), no connection management overhead, no VPC needed, scales to zero between requests.

**Downsides:** External vendor dependency — Neon is not part of AWS. CDK cannot provision or manage it; credentials must be handled out-of-band. Adds vendor risk (pricing changes, availability, data residency). The 0.5 GB free tier is tighter than RDS's 20 GB. Not a fit if the requirement is to stay entirely within AWS.

---

## Recommendation

**Option 1 — RDS PostgreSQL.**

The admin analytics requirements are the deciding factor. Aggregate queries, joins across users/photos/locations, and filtered pagination are natural SQL. DynamoDB can do this but requires a significantly more complex data model and separate aggregation infrastructure — complexity that isn't justified when the data is inherently relational.

Neon is genuinely compelling from a Lambda integration standpoint, but it introduces a non-AWS vendor dependency that complicates the CDK deployment story and adds risk for a project where infrastructure reproducibility is a stated goal.

The connection limit problem (Option 1's main downside) is already solved in the serverless ADR with reserved concurrency + tight pool hygiene. It's a known, bounded constraint — not a reason to choose a fundamentally different data model.

### Upgrade path

| Trigger | Action |
|---|---|
| Hitting 20 GB storage | Add a read replica or archive old photos to S3-only storage |
| Connection saturation in production | Add RDS Proxy ($11/month) — already designed for in serverless ADR |
| t2.micro CPU bottleneck | Upgrade to t3.small ($0.026/hour, ~$19/month) |

---

## Schema

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_id  TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  s3_key       TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id  UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  lat       NUMERIC(9, 6),
  lng       NUMERIC(9, 6)
);

-- Indexes for common query patterns
CREATE INDEX ON photos(user_id);
CREATE INDEX ON photos(status, uploaded_at DESC);
CREATE INDEX ON locations(name);
```

---

## References

- [Amazon RDS free tier](https://aws.amazon.com/rds/free/)
- [RDS PostgreSQL max_connections](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html)
- [DynamoDB free tier](https://aws.amazon.com/dynamodb/pricing/on-demand/)
- [DynamoDB single-table design (AWS blog)](https://aws.amazon.com/blogs/compute/creating-a-single-table-design-with-amazon-dynamodb/)
- [Neon serverless driver](https://neon.tech/docs/serverless/serverless-driver)
- [node-postgres Pool API](https://node-postgres.com/apis/pool)
