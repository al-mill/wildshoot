# Wild Shoot 📸

A DevOps-focused photo-sharing application that enables users to upload photos with location metadata while providing administrators with comprehensive analytics. Built entirely on AWS free tier services with emphasis on infrastructure automation, CI/CD practices, and scalable architecture.

## Features

### User Features

- 🔐 User authentication with profile pictures (AWS Cognito)
- 📤 Photo upload with location tagging and optional descriptions
- 👀 Photo preview before submission
- 📱 Responsive web interface

### Admin Features

- 📊 User analytics dashboard showing upload counts per user
- 📍 Location-based photo statistics and filtering
- 📄 Paginated photo gallery with administrative controls
- 👥 User management with photo count statistics

## Tech Stack (TDB)

- **Frontend:** Nuxt 3/Vue 3 with TypeScript
- **Backend:** AWS Lambda (Serverless)
- **Database:** PostgreSQL on AWS RDS
- **Storage:** AWS S3 + CloudFront CDN
- **Authentication:** AWS Cognito
- **Infrastructure:** AWS CDK (Infrastructure as Code)
- **CI/CD:** GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS CDK CLI installed
- PostgreSQL (for local development)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/al-mill/wildshoot.git
   cd wildshoot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Deploy infrastructure (staging):

   ```bash
   npm run deploy:staging
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
wildshoot/
├── cdk/                 # AWS CDK infrastructure code
├── frontend/            # Nuxt 3 frontend application
├── lambda/             # Lambda function source code
├── database/           # Database schemas and migrations
├── .github/workflows/  # GitHub Actions CI/CD
└── docs/              # Documentation
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run generate` - Generate static site
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run deploy:staging` - Deploy to staging
- `npm run deploy:production` - Deploy to production

### Environment Variables

See `.env.example` for required environment variables.

## Deployment

The application uses blue/green deployment through GitHub Actions:

1. Push to `staging` branch triggers deployment to staging environment
2. Push to `main` branch triggers deployment to production environment
3. Infrastructure changes are managed through AWS CDK

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
