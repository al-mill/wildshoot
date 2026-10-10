# Wild Shoot

A photo-sharing app with location tagging, built on AWS free tier. Users upload photos, admins get analytics. Infrastructure managed with AWS CDK.

## Tech Stack

- **Frontend:** Nuxt 3 / Vue 3 / TypeScript
- **Infrastructure:** AWS CDK (TypeScript)
- **Compute:** AWS Lambda
- **Database:** PostgreSQL on RDS
- **Storage:** S3 + CloudFront
- **Auth:** AWS Cognito
- **CI/CD:** GitHub Actions

## Local Development

### Prerequisites

- Node.js >= 20.19.0 (see `.nvmrc`)
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Setup

```bash
git clone https://github.com/al-mill/wildshoot.git
cd wildshoot
npm install
cp .env.example .env
```

Auth is real Cognito; photos and admin data are still mock store data. Fill these in `.env` from the `wildshoot-staging` stack outputs (`npm run deploy:staging` prints them):

| `.env` key                         | Stack output       |
| ---------------------------------- | ------------------ |
| `NUXT_PUBLIC_COGNITO_USER_POOL_ID` | `UserPoolId`       |
| `NUXT_PUBLIC_COGNITO_CLIENT_ID`    | `UserPoolClientId` |
| `NUXT_PUBLIC_API_URL`              | `ApiUrl`           |

### Run the dev server

```bash
npm run dev
# → http://localhost:3000
```

Register at `/register` and confirm with the emailed code. Admin access comes from the Cognito `admins` group:

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> \
  --username <email> --group-name admins --profile wildshoot
```

Log out and back in to pick up the group. The API only accepts browser calls from `http://localhost:3000` for now (see `architechure_desision_records/api.md` → Open items).

### Scripts

| Command              | Description              |
| -------------------- | ------------------------ |
| `npm run dev`        | Start Nuxt dev server    |
| `npm run build`      | Build for production     |
| `npm run preview`    | Preview production build |
| `npm run test`       | Run unit tests           |
| `npm run lint`       | Run ESLint               |
| `npm run type-check` | TypeScript type check    |

### CDK scripts

| Command                     | Description                               |
| --------------------------- | ----------------------------------------- |
| `npm run cdk:synth`         | Synthesise CloudFormation template        |
| `npm run deploy:staging`    | Deploy to staging                         |
| `npm run deploy:production` | Deploy to production                      |
| `npm run bootstrap`         | Bootstrap CDK in a new AWS account/region |

## Project Structure

```
wildshoot/
├── assets/css/          # Global CSS (design tokens)
├── cdk/
│   ├── bin/app.ts       # CDK entry point
│   ├── lib/constructs/  # Auth, API, network, database, storage
│   └── lib/stacks/      # Stack definitions
├── components/
│   ├── admin/           # Admin-only components
│   ├── AppHeader.vue
│   ├── PhotoCard.vue
│   ├── PhotoGrid.vue
│   └── UploadForm.vue
├── composables/         # useApi (API calls + token refresh), useCognito
├── lambda/              # Lambda handlers: authorizers/, auth/, _shared/
├── layouts/
│   ├── default.vue      # Main layout with header
│   └── admin.vue        # Admin layout with sidebar
├── middleware/
│   ├── auth.ts          # Redirect unauthenticated users
│   └── admin.ts         # Restrict to admin users
├── pages/
│   ├── index.vue        # Photo feed / landing
│   ├── login.vue
│   ├── register.vue
│   ├── upload.vue
│   └── admin/           # Dashboard, users, photos
├── stores/              # Pinia stores (auth is real; photos/admin still mock)
│   ├── auth.ts
│   ├── photos.ts
│   └── admin.ts
└── types/index.ts       # Shared TypeScript types
```

## Connecting to the Real Backend

Each photos/admin store action has a `// TODO:` comment showing the API endpoint to replace the mock with. Swap the mock `wait()` calls for `useApi()` calls from `composables/useApi.ts`, which sends the Cognito access token and refreshes it on a 401.

## Deployment

Staging and production are separate CDK stacks:

- Staging → `npm run deploy:staging` locally (run `aws sso login --profile wildshoot` first)
- Production → the manual **Deploy → Production** GitHub Actions workflow

## License

MIT
