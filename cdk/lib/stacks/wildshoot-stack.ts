import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiConstruct } from '../constructs/api';
import { AuthConstruct } from '../constructs/auth';

// Localhost only until the frontend is hosted; swap in the real origin per
// stage then (architechure_desision_records/api.md → Open items).
const FRONTEND_ORIGIN = 'http://localhost:3000';

interface WildshootStackProps extends cdk.StackProps {
  stage: string;
}

export class WildshootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WildshootStackProps) {
    super(scope, id, props);

    const auth = new AuthConstruct(this, 'Auth', { stage: props.stage });

    new ApiConstruct(this, 'Api', {
      stage: props.stage,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      allowedOrigin: FRONTEND_ORIGIN,
    });
  }
}
