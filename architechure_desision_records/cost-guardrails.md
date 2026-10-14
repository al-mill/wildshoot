# Cost Guardrails

> **Added 2026-10-14.** The database ADR made the free tier a hard requirement. This ADR covers what stops the stack from leaving it.

## Context

- **Free tier is a hard requirement.** `spec.md`: "Built entirely on AWS free tier services."
- **Only Always Free offers count.** The account is a member of an AWS Organization, which gets one free tier per payer account. S3 storage that the 12-month tier would cover is already billed at standard rates (see the database ADR, Option 1).
- **AWS has no spending cap.** A bug, a retry loop or a scripted client can run up a bill. A design that is cheap at normal use isn't enough; the stack needs limits.
- **One accepted exception: API Gateway REST.** It costs $3.50 per million calls and has no Always Free tier. Spend of up to about $3.50 a month is accepted, as long as throttling caps it.
- **S3 has no Always Free tier either.** Storage is $0.023/GB-month. Photo limits cap it instead.

## Decision

Four guardrails. Each ships with the thing it guards, so none waits on features that don't exist yet.

| #   | Guardrail                                                                                                                                                                                                        | Guards                                               | Status            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------- |
| 1   | **API throttle.** A per-method stage default, with a test that holds both stages' total to the monthly budget (below).                                                                                           | API Gateway calls, and the Lambda calls behind them  | Built             |
| 2   | **Limits in code, held by tests.** Lambda 128 MB / 3 s; 14-day log retention; DynamoDB at 12 / 12 per stage with no auto scaling; S3 lifecycle rules; per-user and global photo caps; a resource-type allowlist. | Lambda, CloudWatch Logs, DynamoDB, S3, new resources | With each feature |
| 3   | **Budget and kill switch.** One AWS Budget at $2.00/month (below).                                                                                                                                               | Everything, including what 1 and 2 miss              | Next              |
| 4   | **Upgrade rule.** Anything billed outside an Always Free offer needs an amendment to this ADR, with its measured price, before it is built.                                                                      | Design drift                                         | Now               |

The allowlist test fails the build on any resource type not on its list. Hourly-billed resources stay off the list: RDS, NAT gateways, VPC interface endpoints, Secrets Manager secrets, customer-managed KMS keys and provisioned concurrency.

## API throttle

**API Gateway throttles each method in its own bucket.** The stage setting is "applied at the API method level", so a stage-wide rate is a per-method rate, and the ceiling grows with every method. Staging and production share the account, so it counts both stages:

```
monthly ceiling = stages × methods × (rate × seconds in a month + burst)
```

| Setting                | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| Stage default (`/*/*`) | 0.0125 req/s, burst 10                                           |
| Methods                | 6 per stage: `POST` and `OPTIONS` on login, refresh and logout   |
| Ceiling (31-day month) | 2 stages × 6 × (0.0125 × 2,678,400 + 10) = 401,880 calls ≈ $1.41 |
| Per route, in practice | About one call every 80 s sustained, bursts of 10                |

`cdk/test/api.test.ts` fails if the ceiling across both stages passes 402,000 calls, if any per-method override exists (it would escape the sum), or if one stack's API gets a second stage. Each new route therefore means re-splitting the rate, or amending the budget here.

- **Preflight only where the browser needs it.** Every `OPTIONS` method is another billable bucket, so CORS preflight is added per route and not across the API. Serving the API from the frontend's origin (CloudFront `/api/*`) later removes preflight altogether.
- **The rate tightens as routes are added.** With the planned photo and admin routes the API reaches about 19 methods, or ≈ 0.004 req/s each. Without preflight it's about 11 (≈ 0.007 req/s). Using the full $3.50 instead allows about 2.5× those rates, and giving staging its own account doubles them.
- **Throttling is best-effort.** AWS: "Throttling rates are not hard limits, and are applied on a best-effort basis… Don't rely on throttling to control costs or block access to an API." The budget kill switch is the backstop.
- **Not documented:** whether throttled (429) or authorizer-denied requests are billed for REST APIs (re:Post answers say they aren't), or whether `OPTIONS` calls are. This ADR assumes they are.

## Budget and kill switch

- **One AWS Budget**, $2.00 a month, account-wide. Budget notifications are free.
- **Alerts:** an email at $0.01 actual spend (anything at all) and at 100% of forecast.
- **At 100% actual:** SNS invokes a kill-switch Lambda that:
  - sets the API stage throttle to 0, so every call gets a 429;
  - sets reserved concurrency to 0 on the wildshoot functions;
  - turns off Cognito self sign-up;
  - once the frontend is hosted, disables the CloudFront distribution.
- **To undo it:** invoke the kill switch in restore mode, which reverses each step. CDK passes it the stage's throttle values.
- **Why not `cdk deploy`:** with no template change it's a no-op. `cdk deploy --revert-drift` resets drifted properties, but only ones the template sets, so reserved concurrency would stay at 0.

Budget data lags actual usage by hours, so the switch catches a sustained overrun rather than a spike. That is why guardrails 1 and 2 come first.

## Worst case per month

With every cap in place:

| Item                                   | Cap                                                                         | Worst case       |
| -------------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| API Gateway REST                       | 401,880 calls across both stages (above)                                    | $1.41            |
| Lambda requests (1M Always Free)       | ≤ 2 per API call (handler, plus the authorizer on a cache miss): ≤ 804k     | $0               |
| Lambda compute (400k GB-s Always Free) | 128 MB × 3 s × 804k ≈ 301k GB-s; image processing bounded by the photo cap  | $0               |
| DynamoDB (25 / 25 Always Free)         | 12 / 12 per stage, 24 / 24 for both (database ADR)                          | $0               |
| S3                                     | ~2,000 photos × ≤ 5 MB ≈ 10 GB at $0.023/GB-month, uploads $0.005 per 1,000 | ≈ $0.25          |
| CloudWatch Logs (5 GB Always Free)     | 14-day retention; volume bounded by the throttle                            | $0               |
| Cognito (Essentials, 10k MAU free)     | The kill switch turns off self sign-up                                      | $0 under 10k MAU |
| **Total**                              |                                                                             | **≈ $1.66**      |

The kill switch fires at $2.00, above this total, so it only trips when a cap has failed.

## Alternatives considered

| Option                                      | Why not                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| One stage-wide rate of 0.15 req/s           | Applied per method, it allows 0.15 req/s on each one: 9× the intended ceiling with the original 9 methods.                            |
| Usage plan with a monthly quota             | Counted per API key, and the key would ship in the frontend. AWS calls quotas best-effort too and points to Budgets for cost control. |
| AWS WAF rate-based rule                     | Not free: $5.00/month per web ACL, plus $1.00 per rule and $0.60 per million requests.                                                |
| Lambda Function URLs instead of API Gateway | Free, but would mean reworking the merged auth API and its cached authorizer. Revisit if API Gateway spend shows up on the bill.      |

## References

- [API Gateway request throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- [API Gateway stages: throttling is best-effort](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-stages.html)
- [API Gateway usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)
- [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/)
- [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)
- [AWS WAF pricing](https://aws.amazon.com/waf/pricing/)
- [Lambda pricing and free tier](https://aws.amazon.com/lambda/pricing/)
