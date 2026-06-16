import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

interface WildshootStackProps extends cdk.StackProps {
  stage: string
}

export class WildshootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WildshootStackProps) {
    super(scope, id, props)

    // Phase 2: Auth — Cognito user pool
    // Phase 2: Database — RDS PostgreSQL + VPC
    // Phase 3: Storage — S3 buckets
    // Phase 3: API — API Gateway + Lambda functions
    // Phase 3: CDN — CloudFront distribution
  }
}
