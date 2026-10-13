# Auth Architecture Decision

## What we need

Building a photo app where users can upload/share photos. Need to handle:

- Basic user stuff: signup, login, profiles
- Photo ownership - users can only mess with their own photos
- Admin access for analytics and moderation
- Maybe subscription tiers later
- Keep costs at $0 while we're small

## Technical setup

Using Nuxt for the frontend with SSR, AWS Lambda + API Gateway for the backend. Want to stay in the free tier and need user info available in all our Lambda functions.

## What we're going with

**AWS Cognito + custom Lambda authorizer**

The flow looks like:

```
Nuxt app → API Gateway → Lambda Authorizer → Our business logic
```

## Why this works:

- Cognito handles all the annoying user management stuff (passwords, email verification, etc.)
- Our Lambda authorizer does the photo ownership checks and custom logic
- Cognito is free for our expected usage
- We get full user context in our Lambda functions

**How it breaks down:**

Cognito does:

- User signup/login/password resets
- JWT tokens
- User groups (regular users, admins)
- MFA if we want it later

Our Lambda authorizer does:

- Validates the Cognito access token (signature, expiry, client)
- Passes user id and groups to our app logic

Our handlers do (amended 2026-10-09, see below):

- Photo ownership checks (`WHERE user_id = $1`)
- Subscription limits and business rules

## Other options we looked at

**Just using Cognito's built-in authorizer:**
Simple but can't do photo ownership checks. Would work for basic apps but not for ours.

**Building our own auth from scratch:**
Total control but way too much work. Would need to build password handling, email verification, session management, etc. Nope.

**Auth0 or similar:**
Good option but costs $23/month minimum. Cognito gives us the same features for free.

**Why Cognito + Lambda won:**
Gets us managed user auth + flexible business logic while staying free.

## How it actually works

```
1. User logs in via `POST /api/auth/login` → our Lambda exchanges the credentials with Cognito and returns the tokens
2. Browser keeps them in Secure, SameSite=Strict cookies and refreshes the access token via `POST /api/auth/refresh` before it expires
3. API calls go through API Gateway with the access token
4. Our Lambda authorizer validates the token
5. If good, request goes to our app logic with user context (id + groups)
```

The Lambda authorizer gets the token, makes sure it's legit, and passes user info along. Handlers decide what that user may do (like "does this user own this photo?").

## What this gets us

**Good stuff:**

- Free (stays in AWS free tier with 50k users/month)
- Don't have to build user management ourselves
- Can do complex permission checks like photo ownership
- User info available everywhere in our code
- Can add more business rules later without changing much

**Not so good:**

- Have to write and maintain the Lambda authorizer (~200 lines of code)
- Need to monitor it and handle edge cases
- Takes about 3 extra days vs just using basic Cognito
- Need to cache JWT validation to keep it fast

**Performance targets:**

- Should be under 50ms when cached
- Under 500ms on cache miss
- Expecting about 2000 auth checks per month (well within free tier)

**If this bites us later:**
We're caching the JWT validation keys and auth decisions to keep things fast. Got monitoring set up for auth failures. If we grow big, costs are still reasonable (~$5-15/month for 10k daily users).

## Amendment — 2026-10-09

**Ownership and business rules moved from the authorizer to the handlers.** API Gateway caches the authorizer's decision per token and reuses it for every route, so a per-photo decision there would be wrong on the next route. Checking ownership would also put the authorizer in the VPC with a DB connection. It now only verifies the token, runs outside the VPC, and needs no DB.

**Tokens live in the browser, not on a Nuxt server.** Login, refresh and logout go through `/api/auth/*`; sign-up, confirmation and password reset call Cognito directly from the browser. There is no Nuxt server hosting yet, so the API returns tokens in the response body. Tokens sit in `Secure`, `SameSite=Strict` cookies that JavaScript can read, so an XSS bug could steal them. Revisit (Nuxt server routes + httpOnly cookies) once the frontend is hosted.

**Logout limit.** `GlobalSignOut` revokes the refresh token, but an access token already issued still verifies offline until it expires (≤ 1 h), plus up to 5 min of authorizer cache.
