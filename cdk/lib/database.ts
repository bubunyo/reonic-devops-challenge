import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseConfig {
  instanceClass: ec2.InstanceClass;
  instanceSize: ec2.InstanceSize;
  allocatedStorage: number;
  databaseName: string;
  port: number;
  backupRetentionDays: number;
  deletionProtection: boolean;
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  instanceClass: ec2.InstanceClass.BURSTABLE3,
  instanceSize: ec2.InstanceSize.MICRO,
  allocatedStorage: 20,
  databaseName: 'postgres',
  port: 5432,
  backupRetentionDays: 3,
  deletionProtection: true
};

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  databaseConfig?: Partial<DatabaseConfig>;
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const config: DatabaseConfig = {
      ...DEFAULT_DATABASE_CONFIG,
      ...props.databaseConfig
    };

    // Create database credentials secret
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'postgres'
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
      },
    });

    // Security group for RDS - allows access only from private subnets
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    // Allow inbound connections from private subnets only
    props.vpc.privateSubnets.forEach((subnet, index) => {
      dbSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(subnet.ipv4CidrBlock),
        ec2.Port.tcp(config.port),
        `Allow PostgreSQL from private subnet ${index + 1}`
      );
    });

    // Create subnet group for isolated subnets
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc: props.vpc,
      description: 'Subnet group for RDS in isolated subnets',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: [props.vpc.isolatedSubnets[0].availabilityZone], // Single AZ
      },
    });

    // Create RDS PostgreSQL instance
    this.database = new rds.DatabaseInstance(this, 'PostgreSQLInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(config.instanceClass, config.instanceSize),
      vpc: props.vpc,
      subnetGroup,
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: config.databaseName,
      port: config.port,
      allocatedStorage: config.allocatedStorage,
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(config.backupRetentionDays),
      deletionProtection: config.deletionProtection,
      multiAz: false, // Single AZ as requested
      autoMinorVersionUpgrade: true,
      storageEncrypted: true,
    });

    new secretsmanager.CfnSecretTargetAttachment(this, 'DatabaseSecretAttachment', {
      secretId: this.databaseSecret.secretArn,
      targetId: this.database.instanceIdentifier,
      targetType: 'AWS::RDS::DBInstance',
    });

    // // Outputs
    // new cdk.CfnOutput(this, 'DatabaseEndpoint', {
    //   value: this.database.instanceEndpoint.hostname,
    //   description: 'RDS PostgreSQL endpoint',
    // });

    // new cdk.CfnOutput(this, 'DatabaseSecretArn', {
    //   value: this.databaseSecret.secretArn,
    //   description: 'Database credentials secret ARN',
    // });

    // new cdk.CfnOutput(this, 'DatabasePort', {
    //   value: config.port.toString(),
    //   description: 'Database port',
    // });
  }
}
