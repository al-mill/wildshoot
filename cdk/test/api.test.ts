// @vitest-environment node
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { WildshootStack } from '../lib/stacks/wildshoot-stack';

const template = Template.fromStack(
  new WildshootStack(new App(), 'Test', { stage: 'test' })
);

const functionsWithEnv = (envVar: string) =>
  Object.values(
    template.findResources('AWS::Lambda::Function', {
      Properties: {
        Environment: {
          Variables: Match.objectLike({ [envVar]: Match.anyValue() }),
        },
      },
    })
  ).map(fn => fn.Properties);

const postAuthorizationType = (pathPart: string) => {
  const [resourceId] = Object.keys(
    template.findResources('AWS::ApiGateway::Resource', {
      Properties: { PathPart: pathPart },
    })
  );
  const [method] = Object.values(
    template.findResources('AWS::ApiGateway::Method', {
      Properties: { HttpMethod: 'POST', ResourceId: { Ref: resourceId } },
    })
  );
  return method.Properties.AuthorizationType;
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

  it('leaves login and refresh public and protects logout', () => {
    expect(postAuthorizationType('login')).toBe('NONE');
    expect(postAuthorizationType('refresh')).toBe('NONE');
    expect(postAuthorizationType('logout')).toBe('CUSTOM');
  });

  it('has no GET route under /api/auth', () => {
    const gets = template.findResources('AWS::ApiGateway::Method', {
      Properties: { HttpMethod: 'GET' },
    });
    expect(Object.keys(gets)).toHaveLength(0);
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

  it('runs every function on Node 24 outside the VPC with no reserved concurrency', () => {
    const functions = Object.values(
      template.findResources('AWS::Lambda::Function')
    ).map(fn => fn.Properties);
    expect(functions).toHaveLength(4);
    for (const fn of functions) {
      expect(fn.Runtime).toBe('nodejs24.x');
      expect(fn.VpcConfig).toBeUndefined();
      expect(fn.ReservedConcurrentExecutions).toBeUndefined();
    }
  });

  it('passes the client id and allowed origin to the three auth handlers', () => {
    const handlers = functionsWithEnv('ALLOWED_ORIGIN');
    expect(handlers).toHaveLength(3);
    for (const fn of handlers) {
      expect(fn.Environment.Variables.ALLOWED_ORIGIN).toBe(
        'http://localhost:3000'
      );
      expect(fn.Environment.Variables.CLIENT_ID).toBeDefined();
    }
  });
});
