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

- Validates the JWT from Cognito
- Checks if user owns the photo they're trying to access
- Handles subscription limits and business rules
- Passes user info to our app logic

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
1. User logs in → gets JWT from Cognito
2. Nuxt server stores tokens securely
3. API calls go through API Gateway with the JWT
4. Our Lambda authorizer validates the JWT and checks permissions
5. If good, request goes to our app logic with user context
```

The Lambda authorizer is where the magic happens - it gets the JWT, makes sure it's legit, checks if the user can do what they're asking (like "does this user own this photo?"), and then passes along user info to our main functions.

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
