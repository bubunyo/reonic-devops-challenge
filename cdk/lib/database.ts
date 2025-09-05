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
  deletionProtection: false
};

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  databaseConfig?: Partial<DatabaseConfig>;
}

export class DatabaseStack extends cdk.Stack {
  private readonly config: DatabaseConfig;

  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.Secret;


  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    this.config = {
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

    // Allow inbound connections from private subnets with egress (app tier)
    // Note: Using subnet CIDRs instead of security group reference to avoid circular dependency
    props.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    }).subnets.forEach((subnet, index) => {
      dbSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(subnet.ipv4CidrBlock),
        ec2.Port.tcp(this.config.port),
        `Allow PostgreSQL from app subnet ${index + 1}`
      );
    });

    // Preferred: Security group reference method (causes circular dependency)
    // Use allowConnectionsFromSecurityGroup method instead when possible

    // Create subnet group for isolated subnets
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc: props.vpc,
      description: 'Subnet group for RDS in isolated subnets',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create RDS PostgreSQL instance
    this.database = new rds.DatabaseInstance(this, 'PgInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17,
      }),
      instanceType: ec2.InstanceType.of(this.config.instanceClass, this.config.instanceSize),
      vpc: props.vpc,
      subnetGroup,
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: this.config.databaseName,
      port: this.config.port,
      allocatedStorage: this.config.allocatedStorage,
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(this.config.backupRetentionDays),
      deletionProtection: this.config.deletionProtection,
      multiAz: false, // Single AZ as requested
      autoMinorVersionUpgrade: true,
      storageEncrypted: true,
    });
  }

  // New method to allow connections from specific security group
  public allowConnectionsFromSecurityGroup(securityGroup: ec2.ISecurityGroup): void {
    // Get the database security group and add specific rule
    const dbSecurityGroups = this.database.connections.securityGroups;
    if (dbSecurityGroups.length > 0) {
      dbSecurityGroups[0].addIngressRule(
        securityGroup,
        ec2.Port.tcp(this.config.port),
        'Allow PostgreSQL from Lambda security group'
      );
    }
  }
}
