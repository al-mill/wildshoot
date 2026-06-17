import * as cdk from 'aws-cdk-lib';
import { WildshootStack } from '../lib/stacks/wildshoot-stack';
import { CiStack } from '../lib/stacks/ci-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') ?? 'staging';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';

new WildshootStack(app, `Wildshoot-${stage}`, {
  stage,
  env: { account, region },
  stackName: `wildshoot-${stage}`,
  description: `Wildshoot ${stage} stack`,
});

// Deploy once — creates the GitHub OIDC provider and per-environment IAM roles.
// Run: npx cdk deploy WildshootCi --require-approval never
new CiStack(app, 'WildshootCi', {
  env: { account, region },
  stackName: 'wildshoot-ci',
  description: 'GitHub Actions OIDC provider and deploy roles',
  githubOrg: 'al-mill',
  githubRepo: 'wildshoot',
});
