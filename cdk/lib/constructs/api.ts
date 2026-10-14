import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

interface ApiConstructProps {
  stage: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  allowedOrigin: string;
}

const LAMBDA_DIR = path.join(__dirname, '../../../lambda');

// API Gateway gives every method its own bucket, so the API-wide ceiling is this
// rate times the method count. api.test.ts holds that total to the monthly budget.
const METHOD_RATE_LIMIT = 0.025;
const METHOD_BURST_LIMIT = 10;

export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const fn = (
      fnId: string,
      entry: string,
      environment: Record<string, string>
    ) =>
      new nodejs.NodejsFunction(this, fnId, {
        entry: path.join(LAMBDA_DIR, entry),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_24_X,
        environment,
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: ['@aws-sdk/*'],
          // The root tsconfig extends Nuxt's generated one, which CI doesn't have,
          // so CI and local bundles differed.
          tsconfig: path.join(LAMBDA_DIR, 'tsconfig.bundle.json'),
        },
      });

    const authorizerFn = fn('CognitoAuthorizer', 'authorizers/cognito.ts', {
      USER_POOL_ID: props.userPool.userPoolId,
      CLIENT_ID: props.userPoolClient.userPoolClientId,
    });
    const authEnv = {
      CLIENT_ID: props.userPoolClient.userPoolClientId,
      ALLOWED_ORIGIN: props.allowedOrigin,
    };
    const loginFn = fn('AuthLogin', 'auth/login.ts', authEnv);
    const refreshFn = fn('AuthRefresh', 'auth/refresh.ts', authEnv);
    const logoutFn = fn('AuthLogout', 'auth/logout.ts', authEnv);

    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `wildshoot-${props.stage}`,
      deployOptions: {
        stageName: props.stage,
        throttlingRateLimit: METHOD_RATE_LIMIT,
        throttlingBurstLimit: METHOD_BURST_LIMIT,
      },
    });

    // Preflight only on routes the browser calls: each OPTIONS method is another
    // billable throttle bucket.
    const route = (parent: apigateway.IResource, pathPart: string) =>
      parent.addResource(pathPart, {
        defaultCorsPreflightOptions: {
          allowOrigins: [props.allowedOrigin],
          allowHeaders: ['Authorization', 'Content-Type'],
          allowMethods: apigateway.Cors.ALL_METHODS,
        },
      });

    // Without CORS headers on gateway errors the browser reports a CORS failure
    // instead of the 401 that triggers a token refresh.
    const corsHeaders = {
      'Access-Control-Allow-Origin': `'${props.allowedOrigin}'`,
      'Access-Control-Allow-Headers': "'Authorization,Content-Type'",
    };
    this.api.addGatewayResponse('Default4xx', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsHeaders,
    });
    this.api.addGatewayResponse('Default5xx', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsHeaders,
    });

    const authorizer = new apigateway.TokenAuthorizer(this, 'Authorizer', {
      handler: authorizerFn,
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Login and refresh are how a caller gets a token, so only logout sits behind the authorizer.
    const auth = this.api.root.addResource('api').addResource('auth');
    route(auth, 'login').addMethod(
      'POST',
      new apigateway.LambdaIntegration(loginFn)
    );
    route(auth, 'refresh').addMethod(
      'POST',
      new apigateway.LambdaIntegration(refreshFn)
    );
    route(auth, 'logout').addMethod(
      'POST',
      new apigateway.LambdaIntegration(logoutFn),
      { authorizer }
    );

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'NUXT_PUBLIC_API_URL',
    });
  }
}
