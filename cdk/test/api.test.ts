// @vitest-environment node
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { WildshootStack } from '../lib/stacks/wildshoot-stack';

const template = Template.fromStack(
  new WildshootStack(new App(), 'Test', { stage: 'test' })
);

const findFunction = (envVar: string) => {
  const matches = template.findResources('AWS::Lambda::Function', {
    Properties: {
      Environment: {
        Variables: Match.objectLike({ [envVar]: Match.anyValue() }),
      },
    },
  });
  const [fn] = Object.values(matches);
  return fn.Properties;
};

describe('ApiConstruct', () => {
  it('deploys the REST API to a stage named after the environment', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'test',
    });
  });

  it('uses a cached TOKEN authorizer on the Authorization header', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      IdentitySource: 'method.request.header.Authorization',
      AuthorizerResultTtlInSeconds: 300,
    });
  });

  it('protects GET /api/me with the authorizer', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      AuthorizationType: 'CUSTOM',
      AuthorizerId: Match.anyValue(),
    });
  });

  it('leaves CORS preflight unauthenticated', () => {
    const options = template.findResources('AWS::ApiGateway::Method', {
      Properties: { HttpMethod: 'OPTIONS' },
    });
    const authTypes = Object.values(options).map(
      m => m.Properties.AuthorizationType
    );
    expect(authTypes.length).toBeGreaterThan(0);
    expect(new Set(authTypes)).toEqual(new Set(['NONE']));
  });

  it('adds CORS headers to gateway 4xx and 5xx responses', () => {
    for (const type of ['DEFAULT_4XX', 'DEFAULT_5XX']) {
      template.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
        ResponseType: type,
        ResponseParameters: Match.objectLike({
          'gatewayresponse.header.Access-Control-Allow-Origin':
            "'http://localhost:3000'",
        }),
      });
    }
  });

  it('runs the authorizer outside the VPC with no reserved concurrency', () => {
    const authorizer = findFunction('USER_POOL_ID');
    expect(authorizer.Runtime).toBe('nodejs24.x');
    expect(authorizer.VpcConfig).toBeUndefined();
    expect(authorizer.ReservedConcurrentExecutions).toBeUndefined();
  });

  it('passes the allowed origin to the /api/me handler', () => {
    const me = findFunction('ALLOWED_ORIGIN');
    expect(me.Environment.Variables.ALLOWED_ORIGIN).toBe(
      'http://localhost:3000'
    );
  });
});
