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

No AWS credentials are needed to run the frontend locally — the stores use mock data until the backend is deployed.

### Run the dev server

```bash
npm run dev
# → http://localhost:3000
```

**Test credentials (mock only):**

| Role | Email | Password |
|---|---|---|
| User | `any@example.com` | anything |
| Admin | `admin@example.com` | anything |

Any email starting with `admin` grants access to the `/admin` routes.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Nuxt dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type check |

### CDK scripts

| Command | Description |
|---|---|
| `npm run cdk:synth` | Synthesise CloudFormation template |
| `npm run deploy:staging` | Deploy to staging |
| `npm run deploy:production` | Deploy to production |
| `npm run bootstrap` | Bootstrap CDK in a new AWS account/region |

## Project Structure

```
wildshoot/
├── assets/css/          # Global CSS (design tokens)
├── cdk/
│   ├── bin/app.ts       # CDK entry point
│   └── lib/stacks/      # Stack definitions
├── components/
│   ├── admin/           # Admin-only components
│   ├── AppHeader.vue
│   ├── PhotoCard.vue
│   ├── PhotoGrid.vue
│   └── UploadForm.vue
├── composables/         # useApi — fetch wrapper for real API calls
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
├── stores/              # Pinia stores (mock data — swap for real API)
│   ├── auth.ts
│   ├── photos.ts
│   └── admin.ts
└── types/index.ts       # Shared TypeScript types
```

## Connecting to the Real Backend

Each store action has a `// TODO:` comment showing the API endpoint to replace the mock with. Once the backend is deployed, swap the mock `wait()` calls for the corresponding `useApi()` calls from `composables/useApi.ts`.

## Deployment

Staging and production are separate CDK stacks deployed via GitHub Actions:

- Push to `main` → deploy to staging
- Manual approval → deploy to production

## License

MIT
