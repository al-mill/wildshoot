import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuthConstruct } from '../constructs/auth';

interface WildshootStackProps extends cdk.StackProps {
  stage: string;
}

export class WildshootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WildshootStackProps) {
    super(scope, id, props);

    new AuthConstruct(this, 'Auth', { stage: props.stage });
  }
}
