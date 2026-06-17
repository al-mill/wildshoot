import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface CiStackProps extends cdk.StackProps {
  githubOrg: string;
  githubRepo: string;
}

export class CiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);

    const { githubOrg, githubRepo } = props;

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      // GitHub's OIDC thumbprint — stable, no rotation needed
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // Pull requests — read-only diff access
    const prRole = new iam.Role(this, 'PrRole', {
      roleName: 'wildshoot-github-pr',
      assumedBy: new iam.WebIdentityPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${githubOrg}/${githubRepo}:pull_request`,
          },
        }
      ),
    });

    prRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/cdk-*`],
      })
    );

    new cdk.CfnOutput(this, 'PrRoleArn', {
      value: prRole.roleArn,
      description: 'Copy to PR_ROLE_ARN repo variable in GitHub',
    });

    // Only the "production" GitHub environment can assume this role
    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'wildshoot-github-deploy',
      assumedBy: new iam.WebIdentityPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': `repo:${githubOrg}/${githubRepo}:environment:production`,
          },
        }
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description:
        'Copy to DEPLOY_ROLE_ARN variable in the GitHub production environment',
    });
  }
}
