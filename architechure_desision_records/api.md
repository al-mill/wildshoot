# API Architecture

## Context

Wild Shoot needs a scalable API architecture to handle photo uploads, user authentication, and core application features. The API must integrate seamlessly with our chosen authentication system (AWS Cognito) and photo storage solution (S3), while remaining cost-effective during the startup phase.

We evaluated three main approaches:

- REST API with AWS Lambda + API Gateway
- GraphQL with Apollo Server
- Event-driven microservices with EventBridge

## Decision

We've chosen **AWS API Gateway + Lambda REST Architecture** for our primary API implementation.

## Rationale

### Why API Gateway + Lambda Works for Our Use Case

The serverless approach fits our current needs perfectly. We're building a photo-sharing app where traffic will be unpredictable - could be 10 users one day, 1000 the next. Traditional servers would either waste money sitting idle or crash under unexpected load.

Lambda functions scale automatically and we only pay when code actually runs. For a startup watching every dollar, this matters. The free tier gives us 1 million requests per month, which covers our MVP and early growth completely.

### Cognito Authentication Integration

Since we already decided on Cognito for user management, API Gateway's built-in Lambda Authorizer makes integration straightforward. Here's why this combination works:

**Token Validation Flow:**

1. Frontend sends JWT token with each API request
2. API Gateway routes to our Lambda Authorizer first
3. Authorizer validates token against Cognito's public keys
4. Valid requests get user context injected automatically
5. API Lambda functions receive pre-validated user info

This eliminates the need to validate tokens in every API function. The authorizer runs once, caches the result, and all subsequent requests to protected endpoints just work. No token validation code scattered across 20 different Lambda functions.

**Admin Role Handling:**
Cognito groups map directly to our API permissions. Admin users get an 'admin' group claim in their JWT. Our authorizer extracts this and makes it available to API functions, so admin-only endpoints just check `event.requestContext.authorizer.groups`.

**Session Management:**
Rather than building custom session handling, we leverage Cognito's token refresh system. When access tokens expire, the frontend calls our refresh endpoint, which uses Cognito's refresh token flow. Clean, secure, and we don't store sensitive session data anywhere.

### S3 Image Upload Integration

Photos are the core of our app, so the upload experience needs to be smooth and reliable. S3 integration through Lambda gives us several advantages:

**Direct Upload Processing:**
When users upload photos, our Lambda function receives the image data, validates it, and stores both the original and metadata in one atomic operation. We can:

- Validate image format and size before storage
- Generate consistent file naming (userId/photoId/filename.jpg)
- Store metadata in PostgreSQL while file goes to S3
- Trigger async processing for thumbnails and optimization

**Presigned URL Alternative:**
We considered presigned URLs (frontend uploads directly to S3) but Lambda upload gives us more control:

- Virus scanning before storage
- Consistent metadata extraction
- Proper access control (users can only upload to their own space)
- Audit trail of who uploaded what when

**Async Processing Pipeline:**
Once the original photo hits S3, it triggers our image processing pipeline:

1. S3 event triggers thumbnail generation Lambda
2. AI tagging Lambda extracts keywords
3. Search indexer updates photo discovery
4. User gets notified when processing completes

This happens entirely in the background while the user continues browsing.

## Architecture Overview

```
Frontend (Nuxt/Vue)
        ↓
API Gateway (/api/*)
        ├── Lambda Authorizer (validates Cognito JWT)
        ├── /auth/* → Auth Lambda Functions
        ├── /photos/* → Photo Lambda Functions
        └── /admin/* → Admin Lambda Functions
        ↓
Backend Services
        ├── PostgreSQL (metadata, user data)
        ├── S3 (original photos, thumbnails)
        └── Cognito (authentication, user management)
```

## Implementation Approach

### API Endpoint Structure

```
/api/auth
  POST /login      → Exchange email/password for JWT tokens
  POST /refresh    → Get new access token using refresh token
  POST /logout     → Invalidate refresh token

/api/photos
  GET  /           → List user's photos (paginated)
  POST /           → Upload new photo
  GET  /{id}       → Get specific photo details
  PUT  /{id}       → Update photo metadata
  DELETE /{id}     → Delete photo

/api/admin
  GET  /analytics  → System usage statistics
  GET  /users      → User management interface
  DELETE /users/{id} → Remove user account
```

### Lambda Function Organization

We're organizing by feature, not by HTTP method:

```
lambda/
├── authorizers/
│   └── cognito-auth.ts    → Token validation logic
├── auth/
│   ├── login.ts           → Handle Cognito authentication
│   ├── refresh.ts         → Token refresh logic
│   └── logout.ts          → Session cleanup
├── photos/
│   ├── upload.ts          → Process photo uploads
│   ├── list.ts            → Fetch user photos
│   ├── details.ts         → Single photo information
│   ├── update.ts          → Modify photo metadata
│   └── delete.ts          → Remove photo and cleanup
└── admin/
    ├── analytics.ts       → System statistics
    └── users.ts           → User management operations
```

Each Lambda function handles one specific operation. This keeps functions small, deployment fast, and debugging simple.

### Database and Storage Strategy

**PostgreSQL for Structured Data:**

- User profiles and settings
- Photo metadata (title, description, upload date)
- Comments and likes
- Admin analytics and logs

**S3 for Photo Storage:**

- Original uploads: `photos/originals/{userId}/{photoId}/`
- Thumbnails: `photos/thumbnails/{userId}/{photoId}/`
- Optimized versions: `photos/web/{userId}/{photoId}/`

**Connection Management:**
Lambda functions share a connection pool through Lambda Layers. Each function can handle 20 concurrent database connections, and we provision based on expected traffic.

## Benefits

**Cost Efficiency:** Free tier covers MVP entirely. At scale, pay only for actual usage.

**Auto-Scaling:** Handle traffic spikes without configuration. Black Friday photo uploads? AWS scales automatically.

**Development Speed:** Focus on business logic, not infrastructure. Deploy new endpoints in minutes.

**Reliability:** Multi-AZ deployment by default. If one data center fails, traffic routes elsewhere.

**Security:** API Gateway handles HTTPS, DDoS protection, and rate limiting. Lambda functions run in isolated environments.

**Monitoring:** CloudWatch logs and metrics built-in. X-Ray tracing shows exactly where requests slow down.

## Drawbacks

**Cold Starts:** First request to an idle Lambda takes 200-500ms. Mitigated by keeping functions warm during business hours.

**Connection Limits:** 20 database connections per Lambda instance. Could become bottleneck with heavy database usage.

**Vendor Lock-in:** Deeply integrated with AWS services. Migration to other cloud providers would require significant rewriting.

**Learning Curve:** Team needs to understand Lambda execution model and serverless patterns.

**Local Development:** Testing requires AWS SAM CLI or mocking services. Not as straightforward as running a local server.

## Alternatives Considered

**GraphQL with Apollo Server:** Better for mobile apps with complex data requirements, but adds complexity for simple CRUD operations.

**Event-Driven with EventBridge:** Excellent for high-scale async processing, but overkill for MVP and harder to debug.

**Express.js on ECS:** More familiar development model, but higher operational overhead and cost.

## Success Criteria

- API response times under 500ms (95th percentile)
- Photo upload success rate above 99.5%
- Zero-downtime deployments
- Monthly costs under $50 during first year
- Development team can deploy new endpoints within one day
