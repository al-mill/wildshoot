import * as cdk from 'aws-cdk-lib';
import { WildshootStack } from '../lib/stacks/wildshoot-stack';

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
