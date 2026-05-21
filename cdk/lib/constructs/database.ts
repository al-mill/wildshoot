import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DatabaseConstructProps {
  stage: string;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
}

export class DatabaseConstruct extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly credentials: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    this.credentials = new secretsmanager.Secret(this, 'DbCredentials', {
      secretName: `wildshoot/${props.stage}/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'wildshoot' }),
        generateStringKey: 'password',
        excludeCharacters: '/@"',
      },
    });

    this.instance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO,
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.securityGroup],
      credentials: rds.Credentials.fromSecret(this.credentials),
      databaseName: 'wildshoot',
      storageEncrypted: false,
      multiAz: false,
      autoMinorVersionUpgrade: true,
      deleteAutomatedBackups: props.stage !== 'production',
      removalPolicy:
        props.stage === 'production'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });
  }
}
